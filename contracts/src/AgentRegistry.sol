// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AgentRegistry
 * @notice ERC-8004 agent identity registry on BNB Smart Chain.
 *         Agents self-register with their metadata URI, category, and pricing.
 *         Reputation is updated by the JobEscrow contract after job completion.
 */
contract AgentRegistry {
    // ─── Structs ──────────────────────────────────────────────
    struct Agent {
        address owner;
        uint256 tokenId;        // ERC-8004 token ID
        string metadataURI;     // IPFS/Arweave URI for full profile
        string category;        // "rebalance" | "grid" | "yield" | "health"
        uint256 pricePerJob;    // Price in wei per job
        bool registered;
        bool active;
        uint256 registeredAt;
        // Reputation metrics (updated by escrow)
        uint256 jobsCompleted;
        uint256 jobsFailed;
        uint256 totalRating;    // Sum of all ratings (1-5)
        uint256 ratingCount;
        uint256 stakeSlashed;   // Total stake slashed
    }

    // ─── State ────────────────────────────────────────────────
    mapping(uint256 => Agent) public agents;
    mapping(address => uint256[]) public ownerAgents;
    uint256 public nextTokenId = 1;

    address public escrowContract;
    address public owner;

    // ─── Events ───────────────────────────────────────────────
    event AgentRegistered(uint256 indexed tokenId, address indexed ownerAddr, string category, uint256 pricePerJob, string metadataURI);
    event AgentUpdated(uint256 indexed tokenId, string metadataURI, uint256 pricePerJob, bool active);
    event AgentDeregistered(uint256 indexed tokenId);
    event ReputationUpdated(uint256 indexed tokenId, uint256 jobsCompleted, uint256 jobsFailed, uint256 rating);
    event EscrowSet(address indexed escrow);

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyOwner() { require(msg.sender == owner, "Not owner"); _; }
    modifier onlyEscrow() { require(msg.sender == escrowContract, "Not escrow"); _; }
    modifier onlyAgentOwner(uint256 tokenId) { require(agents[tokenId].owner == msg.sender, "Not agent owner"); _; }

    constructor() {
        owner = msg.sender;
    }

    function setEscrow(address _escrow) external onlyOwner {
        escrowContract = _escrow;
        emit EscrowSet(_escrow);
    }

    // ─── Agent lifecycle ──────────────────────────────────────
    function registerAgent(
        string calldata _metadataURI,
        string calldata _category,
        uint256 _pricePerJob
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        agents[tokenId] = Agent({
            owner: msg.sender,
            tokenId: tokenId,
            metadataURI: _metadataURI,
            category: _category,
            pricePerJob: _pricePerJob,
            registered: true,
            active: true,
            registeredAt: block.timestamp,
            jobsCompleted: 0,
            jobsFailed: 0,
            totalRating: 0,
            ratingCount: 0,
            stakeSlashed: 0
        });
        ownerAgents[msg.sender].push(tokenId);
        emit AgentRegistered(tokenId, msg.sender, _category, _pricePerJob, _metadataURI);
    }

    function updateAgent(
        uint256 tokenId,
        string calldata _metadataURI,
        uint256 _pricePerJob,
        bool _active
    ) external onlyAgentOwner(tokenId) {
        require(agents[tokenId].registered, "Not registered");
        agents[tokenId].metadataURI = _metadataURI;
        agents[tokenId].pricePerJob = _pricePerJob;
        agents[tokenId].active = _active;
        emit AgentUpdated(tokenId, _metadataURI, _pricePerJob, _active);
    }

    function deregisterAgent(uint256 tokenId) external onlyAgentOwner(tokenId) {
        require(agents[tokenId].registered, "Not registered");
        agents[tokenId].active = false;
        agents[tokenId].registered = false;
        emit AgentDeregistered(tokenId);
    }

    function getAgent(uint256 tokenId) external view returns (Agent memory) {
        return agents[tokenId];
    }

    function getAgentsByOwner(address _owner) external view returns (uint256[] memory) {
        return ownerAgents[_owner];
    }

    function getReputation(uint256 tokenId) external view returns (uint256 jobsCompleted, uint256 jobsFailed, uint256 avgRating) {
        Agent storage a = agents[tokenId];
        avgRating = a.ratingCount > 0 ? a.totalRating / a.ratingCount : 0;
        return (a.jobsCompleted, a.jobsFailed, avgRating);
    }

    // ─── Called by escrow after job completion ────────────────
    function updateReputation(
        uint256 tokenId,
        bool success,
        uint256 rating
    ) external onlyEscrow {
        require(rating >= 1 && rating <= 5, "Invalid rating");
        if (success) {
            agents[tokenId].jobsCompleted++;
        } else {
            agents[tokenId].jobsFailed++;
        }
        agents[tokenId].totalRating += rating;
        agents[tokenId].ratingCount++;
        emit ReputationUpdated(tokenId, agents[tokenId].jobsCompleted, agents[tokenId].jobsFailed, rating);
    }
}
