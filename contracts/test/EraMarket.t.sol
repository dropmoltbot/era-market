// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/JobEscrow.sol";
import "../src/FeedbackSystem.sol";

contract EraMarketTest is Test {
    AgentRegistry registry;
    JobEscrow escrow;
    FeedbackSystem feedback;

    address buyer = address(0xBEEF);
    address agent1 = address(0xCAFE);
    address agent2 = address(0xFACE);
    address feeRecipient = address(0xFEED);

    function setUp() public {
        registry = new AgentRegistry();
        escrow = new JobEscrow(address(registry));
        feedback = new FeedbackSystem();

        registry.setEscrow(address(escrow));
        feedback.setEscrow(address(escrow));

        vm.deal(buyer, 100 ether);
        vm.deal(agent1, 10 ether);
        vm.deal(agent2, 10 ether);
    }

    // ─── AgentRegistry tests ──────────────────────────────────

    function testRegisterAgent() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);
        assertEq(tokenId, 1);
        assertEq(registry.nextTokenId(), 2);

        AgentRegistry.Agent memory a = registry.getAgent(tokenId);
        assertEq(a.owner, agent1);
        assertTrue(a.registered);
        assertTrue(a.active);
        assertEq(a.pricePerJob, 0.001 ether);
        assertEq(a.jobsCompleted, 0);
    }

    function testUpdateAgent() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(agent1);
        registry.updateAgent(tokenId, "ipfs://QmNEW", 0.002 ether, true);

        AgentRegistry.Agent memory a = registry.getAgent(tokenId);
        assertEq(a.metadataURI, "ipfs://QmNEW");
        assertEq(a.pricePerJob, 0.002 ether);
    }

    function testDeregisterAgent() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(agent1);
        registry.deregisterAgent(tokenId);

        AgentRegistry.Agent memory a = registry.getAgent(tokenId);
        assertFalse(a.registered);
        assertFalse(a.active);
    }

    function testRevertNonOwnerUpdate() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.expectRevert("Not agent owner");
        vm.prank(agent2);
        registry.updateAgent(tokenId, "ipfs://hack", 0.01 ether, true);
    }

    function testGetAgentsByOwner() public {
        vm.startPrank(agent1);
        uint256 t1 = registry.registerAgent("ipfs://Qm1", "grid", 0.001 ether);
        uint256 t2 = registry.registerAgent("ipfs://Qm2", "yield", 0.002 ether);
        vm.stopPrank();

        uint256[] memory owned = registry.getAgentsByOwner(agent1);
        assertEq(owned.length, 2);
        assertEq(owned[0], t1);
        assertEq(owned[1], t2);
    }

    // ─── JobEscrow tests ─────────────────────────────────────

    function testCreateAndFundJob() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob{value: 0.001 ether}(
            tokenId,
            "grid-trading-bnb-usdt",
            "base64memo"
        );

        assertEq(jobId, 1);
        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Funded));

        JobEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(job.buyer, buyer);
        assertEq(job.amount, 0.001 ether);
        assertEq(job.agentTokenId, tokenId);
    }

    function testFullJobLifecycle() public {
        // Register agent
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        // Create + fund job
        vm.prank(buyer);
        uint256 jobId = escrow.createJob{value: 0.001 ether}(tokenId, "grid-trading", "memo");

        // Agent submits result
        vm.prank(agent1);
        escrow.submitResult(jobId, keccak256("result"));

        // Check Submitted
        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Submitted));

        uint256 agentBalBefore = agent1.balance;
        uint256 feeBalBefore = feeRecipient.balance;
        escrow.setFeeRecipient(feeRecipient);

        // Buyer completes with rating 5
        vm.prank(buyer);
        escrow.completeJob(jobId, 5);

        // Check completed
        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Completed));

        // Check payouts: 1% fee = 0.00001 BNB, agent gets 0.00099 BNB
        uint256 expectedFee = (0.001 ether * 100) / 10000; // 0.00001 ether
        uint256 expectedAgent = 0.001 ether - expectedFee;

        assertEq(agent1.balance - agentBalBefore, expectedAgent);
        assertEq(feeRecipient.balance - feeBalBefore, expectedFee);

        // Check reputation updated
        (uint256 completed, uint256 failed, uint256 avgRating) = registry.getReputation(tokenId);
        assertEq(completed, 1);
        assertEq(failed, 0);
        assertEq(avgRating, 5);
    }

    function testRejectJob() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob{value: 0.001 ether}(tokenId, "grid", "memo");

        vm.prank(agent1);
        escrow.submitResult(jobId, keccak256("bad"));

        uint256 buyerBalBefore = buyer.balance;
        vm.prank(buyer);
        escrow.rejectJob(jobId, "poor quality");

        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Rejected));
        assertEq(buyer.balance - buyerBalBefore, 0.001 ether); // refunded

        (uint256 completed, uint256 failed, ) = registry.getReputation(tokenId);
        assertEq(completed, 0);
        assertEq(failed, 1);
    }

    function testJobExpiry() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob{value: 0.001 ether}(tokenId, "grid", "memo");

        // Warp past timeout
        vm.warp(block.timestamp + 2 hours);

        uint256 buyerBalBefore = buyer.balance;
        escrow.expireJob(jobId);

        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Expired));
        assertEq(buyer.balance - buyerBalBefore, 0.001 ether);

        (, uint256 failed, ) = registry.getReputation(tokenId);
        assertEq(failed, 1);
    }

    function testCancelOpenJob() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob(tokenId, "grid", "memo"); // no ETH

        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Open));

        vm.prank(buyer);
        escrow.cancelJob(jobId);
        assertEq(uint8(escrow.getJobStatus(jobId)), uint8(JobEscrow.JobStatus.Cancelled));
    }

    function testRevertSubmitToUnfundedJob() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob(tokenId, "grid", "memo"); // no ETH

        vm.expectRevert("Job not funded");
        vm.prank(agent1);
        escrow.submitResult(jobId, keccak256("result"));
    }

    function testRevertInactiveAgent() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(agent1);
        registry.updateAgent(tokenId, "ipfs://QmABC", 0.001 ether, false); // deactivate

        vm.expectRevert("Agent not active");
        vm.prank(buyer);
        escrow.createJob{value: 0.001 ether}(tokenId, "grid", "memo");
    }

    function testRevertInvalidRating() public {
        vm.prank(agent1);
        uint256 tokenId = registry.registerAgent("ipfs://QmABC", "grid", 0.001 ether);

        vm.prank(buyer);
        uint256 jobId = escrow.createJob{value: 0.001 ether}(tokenId, "grid", "memo");

        vm.prank(agent1);
        escrow.submitResult(jobId, keccak256("result"));

        vm.expectRevert("Invalid rating");
        vm.prank(buyer);
        escrow.completeJob(jobId, 6);
    }

    // ─── FeedbackSystem tests ─────────────────────────────────

    function testFeedbackFlow() public {
        // The FeedbackSystem requires escrow to verify job first.
        // In a full integration, escrow.completeJob would call feedback.verifyJob.
        // Here we test the feedback contract directly.

        // Simulate escrow verification
        vm.prank(address(escrow));
        feedback.verifyJob(1, buyer, 1);

        // Submit feedback
        vm.prank(buyer);
        feedback.submitFeedback(
            1,
            4,
            keccak256(abi.encodePacked("Great agent!")),
            "ipfs://comment1",
            1
        );

        uint8 avg = feedback.getAvgRating(1);
        assertEq(avg, 4);
        assertEq(feedback.getFeedbackCount(1), 1);
    }

    // ─── Integration test ─────────────────────────────────────

    function testFullIntegration() public {
        // 1. Two agents register
        vm.prank(agent1);
        uint256 t1 = registry.registerAgent("ipfs://agent1", "grid", 0.001 ether);
        vm.prank(agent2);
        uint256 t2 = registry.registerAgent("ipfs://agent2", "yield", 0.002 ether);

        // 2. Buyer hires agent1
        vm.prank(buyer);
        uint256 job1 = escrow.createJob{value: 0.001 ether}(t1, "grid-bnb", "memo1");

        // 3. Agent1 completes the job
        vm.prank(agent1);
        escrow.submitResult(job1, keccak256("r1"));
        escrow.setFeeRecipient(feeRecipient);
        vm.prank(buyer);
        escrow.completeJob(job1, 5);

        // 4. Buyer hires agent2
        vm.prank(buyer);
        uint256 job2 = escrow.createJob{value: 0.002 ether}(t2, "yield-farm", "memo2");

        // 5. Agent2 submits, buyer rejects
        vm.prank(agent2);
        escrow.submitResult(job2, keccak256("bad"));
        vm.prank(buyer);
        escrow.rejectJob(job2, "not profitable");

        // 6. Check reputations
        (uint256 c1, uint256 f1, uint256 r1) = registry.getReputation(t1);
        assertEq(c1, 1);
        assertEq(f1, 0);
        assertEq(r1, 5);

        (uint256 c2, uint256 f2, uint256 r2) = registry.getReputation(t2);
        assertEq(c2, 0);
        assertEq(f2, 1);
        assertEq(r2, 1);
    }
}
