// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentRegistry} from "./AgentRegistry.sol";

/**
 * @title JobEscrow
 * @notice ERC-8183 job escrow on BNB Smart Chain.
 *         Buyer funds a job with BNB. Agent submits result. Buyer or arbitrator settles.
 *         On completion: funds released to agent + reputation updated.
 *         On timeout/expiry: funds refunded to buyer.
 */
contract JobEscrow {
    // ─── Structs ──────────────────────────────────────────────
    enum JobStatus { Open, Funded, Submitted, Completed, Rejected, Expired, Cancelled }

    struct Job {
        uint256 jobId;
        address buyer;
        address agentOwner;
        uint256 agentTokenId;
        uint256 amount;
        JobStatus status;
        uint256 createdAt;
        uint256 expiresAt;
        bytes32 resultHash;
        uint8 buyerRating;
    }

    // ─── State ────────────────────────────────────────────────
    mapping(uint256 => Job) public jobs;
    uint256[] public allJobIds;
    uint256 public nextJobId = 1;

    AgentRegistry public registry;
    address public owner;
    uint256 public constant DEFAULT_TIMEOUT = 1 hours;
    uint256 public constant PLATFORM_FEE_BPS = 100; // 1% platform fee

    address public feeRecipient;

    // ─── Events ───────────────────────────────────────────────
    event JobCreated(uint256 indexed jobId, address indexed buyer, uint256 indexed agentTokenId, uint256 amount, string scope, string memo);
    event JobFunded(uint256 indexed jobId, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, bytes32 resultHash);
    event JobCompleted(uint256 indexed jobId, uint8 rating, uint256 agentPayout, uint256 platformFee);
    event JobRejected(uint256 indexed jobId, string reason);
    event JobExpired(uint256 indexed jobId, uint256 refundAmount);
    event JobCancelled(uint256 indexed jobId, uint256 refundAmount);

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyBuyer(uint256 jobId) { require(jobs[jobId].buyer == msg.sender, "Not buyer"); _; }
    modifier onlyAgentOwner(uint256 jobId) { require(jobs[jobId].agentOwner == msg.sender, "Not agent"); _; }
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }

    constructor(address _registry) {
        registry = AgentRegistry(_registry);
        owner = msg.sender;
        feeRecipient = msg.sender;
    }

    function setFeeRecipient(address _fee) external onlyOwner {
        feeRecipient = _fee;
    }

    // ─── Job lifecycle ────────────────────────────────────────

    /// @notice Create a new job and fund it in the same transaction
    function createJob(
        uint256 agentTokenId,
        string calldata _scope,
        string calldata _memo
    ) external payable returns (uint256 jobId) {
        AgentRegistry.Agent memory agent = registry.getAgent(agentTokenId);
        require(agent.registered && agent.active, "Agent not active");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            jobId: jobId,
            buyer: msg.sender,
            agentOwner: agent.owner,
            agentTokenId: agentTokenId,
            amount: msg.value,
            status: msg.value > 0 ? JobStatus.Funded : JobStatus.Open,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + DEFAULT_TIMEOUT,
            resultHash: bytes32(0),
            buyerRating: 0
        });
        allJobIds.push(jobId);

        emit JobCreated(jobId, msg.sender, agentTokenId, msg.value, _scope, _memo);
        if (msg.value > 0) emit JobFunded(jobId, msg.value);
    }

    /// @notice Fund an existing open job
    function fundJob(uint256 jobId) external payable onlyBuyer(jobId) {
        require(jobs[jobId].status == JobStatus.Open, "Job not open");
        require(msg.value > 0, "No funds sent");
        jobs[jobId].amount = msg.value;
        jobs[jobId].status = JobStatus.Funded;
        emit JobFunded(jobId, msg.value);
    }

    /// @notice Agent submits the result
    function submitResult(
        uint256 jobId,
        bytes32 _resultHash
    ) external onlyAgentOwner(jobId) {
        require(jobs[jobId].status == JobStatus.Funded, "Job not funded");
        require(block.timestamp < jobs[jobId].expiresAt, "Job expired");

        jobs[jobId].status = JobStatus.Submitted;
        jobs[jobId].resultHash = _resultHash;

        emit JobSubmitted(jobId, _resultHash);
    }

    /// @notice Buyer confirms completion and rates the agent
    function completeJob(uint256 jobId, uint8 _rating) external onlyBuyer(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Submitted, "Job not submitted");
        require(_rating >= 1 && _rating <= 5, "Invalid rating");

        job.status = JobStatus.Completed;
        job.buyerRating = _rating;

        // Calculate payouts
        uint256 fee = (job.amount * PLATFORM_FEE_BPS) / 10000;
        uint256 agentPayout = job.amount - fee;

        // Pay agent
        (bool sent, ) = payable(job.agentOwner).call{value: agentPayout}("");
        require(sent, "Agent payment failed");

        // Pay platform fee
        if (fee > 0) {
            (bool feeSent, ) = payable(feeRecipient).call{value: fee}("");
            require(feeSent, "Fee payment failed");
        }

        // Update reputation in registry
        registry.updateReputation(job.agentTokenId, true, _rating);

        emit JobCompleted(jobId, _rating, agentPayout, fee);
    }

    /// @notice Buyer rejects the result
    function rejectJob(uint256 jobId, string calldata _reason) external onlyBuyer(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Submitted, "Job not submitted");

        job.status = JobStatus.Rejected;

        // Refund buyer
        (bool sent, ) = payable(job.buyer).call{value: job.amount}("");
        require(sent, "Refund failed");

        // Update reputation (failed job)
        registry.updateReputation(job.agentTokenId, false, 1);

        emit JobRejected(jobId, _reason);
    }

    /// @notice Anyone can expire a funded job that timed out
    function expireJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Funded, "Job not funded");
        require(block.timestamp >= job.expiresAt, "Job not expired yet");

        job.status = JobStatus.Expired;

        // Refund buyer
        (bool sent, ) = payable(job.buyer).call{value: job.amount}("");
        require(sent, "Refund failed");

        // Update reputation (failed job)
        registry.updateReputation(job.agentTokenId, false, 1);

        emit JobExpired(jobId, job.amount);
    }

    /// @notice Buyer cancels an open (unfunded) job
    function cancelJob(uint256 jobId) external onlyBuyer(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == JobStatus.Open, "Job not open");

        job.status = JobStatus.Cancelled;
        emit JobCancelled(jobId, 0);
    }

    // ─── Views ────────────────────────────────────────────────
    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getJobStatus(uint256 jobId) external view returns (JobStatus) {
        return jobs[jobId].status;
    }

    function getJobCount() external view returns (uint256) {
        return allJobIds.length;
    }

    function getJobsByBuyer(address _buyer) external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](allJobIds.length);
        uint256 count = 0;
        for (uint256 i = 0; i < allJobIds.length; i++) {
            if (jobs[allJobIds[i]].buyer == _buyer) {
                result[count++] = allJobIds[i];
            }
        }
        assembly { mstore(result, count) }
        return result;
    }
}
