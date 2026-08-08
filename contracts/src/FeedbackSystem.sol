// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FeedbackSystem
 * @notice On-chain feedback for ERC-8004 agents.
 *         Buyers can rate agents 1-5 and store a hash of their comment on DA.
 *         Only buyers who completed a job can leave feedback.
 */
contract FeedbackSystem {
    struct Feedback {
        uint256 agentTokenId;
        address reviewer;
        uint8 rating;       // 1-5
        bytes32 commentHash; // Hash of the full comment (stored on DA)
        string commentURI;  // URI to full comment on IPFS/Arweave
        uint256 timestamp;
        uint256 jobId;      // Associated job
    }

    //tokenId => Feedback[]
    mapping(uint256 => Feedback[]) public agentFeedback;
    //tokenId => totalRating
    mapping(uint256 => uint256) public totalRatingSum;
    mapping(uint256 => uint256) public feedbackCount;

    address public escrowContract;
    address public owner;

    // Verified job completions: jobId => completed
    mapping(uint256 => bool) public verifiedJobs;
    // jobId => buyer
    mapping(uint256 => address) public jobBuyer;

    event FeedbackSubmitted(uint256 indexed agentTokenId, address indexed reviewer, uint8 rating, bytes32 commentHash, string commentURI, uint256 jobId);
    event JobVerified(uint256 indexed jobId, address indexed buyer, uint256 agentTokenId);
    event EscrowSet(address escrow);

    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyEscrow() { require(msg.sender == escrowContract, "Not escrow"); _; }

    constructor() {
        owner = msg.sender;
    }

    function setEscrow(address _escrow) external onlyOwner {
        escrowContract = _escrow;
        emit EscrowSet(_escrow);
    }

    /// @notice Called by escrow when a job is completed
    function verifyJob(uint256 jobId, address buyer, uint256 agentTokenId) external onlyEscrow {
        verifiedJobs[jobId] = true;
        jobBuyer[jobId] = buyer;
        emit JobVerified(jobId, buyer, agentTokenId);
    }

    /// @notice Buyer submits feedback after job completion
    function submitFeedback(
        uint256 agentTokenId,
        uint8 _rating,
        bytes32 _commentHash,
        string calldata _commentURI,
        uint256 _jobId
    ) external {
        require(verifiedJobs[_jobId], "Job not verified");
        require(jobBuyer[_jobId] == msg.sender, "Not job buyer");
        require(_rating >= 1 && _rating <= 5, "Invalid rating");

        Feedback memory fb = Feedback({
            agentTokenId: agentTokenId,
            reviewer: msg.sender,
            rating: _rating,
            commentHash: _commentHash,
            commentURI: _commentURI,
            timestamp: block.timestamp,
            jobId: _jobId
        });

        agentFeedback[agentTokenId].push(fb);
        totalRatingSum[agentTokenId] += _rating;
        feedbackCount[agentTokenId]++;

        emit FeedbackSubmitted(agentTokenId, msg.sender, _rating, _commentHash, _commentURI, _jobId);
    }

    function getFeedback(uint256 agentTokenId) external view returns (Feedback[] memory) {
        return agentFeedback[agentTokenId];
    }

    function getAvgRating(uint256 agentTokenId) external view returns (uint8) {
        if (feedbackCount[agentTokenId] == 0) return 0;
        return uint8(totalRatingSum[agentTokenId] / feedbackCount[agentTokenId]);
    }

    function getFeedbackCount(uint256 agentTokenId) external view returns (uint256) {
        return feedbackCount[agentTokenId];
    }
}
