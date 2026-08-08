import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { useMemo, useState, useEffect } from 'react'
import AgentRegistryABI from './AgentRegistry.abi.json'
import JobEscrowABI from './JobEscrow.abi.json'
import FeedbackSystemABI from './FeedbackSystem.abi.json'
import contracts from './contracts.json'

export const CONTRACTS = contracts

// ─── AgentRegistry hooks ────────────────────────────────────

export function useAgentReputation(tokenId) {
  const { data, isLoading } = useReadContract({
    address: contracts.registry,
    abi: AgentRegistryABI,
    functionName: 'getReputation',
    args: [BigInt(tokenId || 0)],
    enabled: tokenId != null,
  })

  if (!data) return { jobsCompleted: 0, jobsFailed: 0, avgRating: 0, isLoading }
  const [jobsCompleted, jobsFailed, avgRating] = data
  return { jobsCompleted: Number(jobsCompleted), jobsFailed: Number(jobsFailed), avgRating: Number(avgRating), isLoading }
}

export function useAgentInfo(tokenId) {
  const { data, isLoading } = useReadContract({
    address: contracts.registry,
    abi: AgentRegistryABI,
    functionName: 'getAgent',
    args: [BigInt(tokenId || 0)],
    enabled: tokenId != null,
  })

  if (!data) return null
  return {
    owner: data.owner,
    tokenId: Number(data.tokenId),
    metadataURI: data.metadataURI,
    category: data.category,
    pricePerJob: data.pricePerJob.toString(),
    registered: data.registered,
    active: data.active,
    jobsCompleted: Number(data.jobsCompleted),
    jobsFailed: Number(data.jobsFailed),
    totalRating: Number(data.totalRating),
    ratingCount: Number(data.ratingCount),
    isLoading,
  }
}

export function useRegisterAgent() {
  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState(null)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const register = async (metadataURI, category, pricePerJobEth) => {
    const hash = await writeContractAsync({
      address: contracts.registry,
      abi: AgentRegistryABI,
      functionName: 'registerAgent',
      args: [metadataURI, category, parseEther(pricePerJobEth)],
    })
    setTxHash(hash)
    return hash
  }

  return { register, isPending, isConfirming, isSuccess }
}

// ─── JobEscrow hooks ────────────────────────────────────────

export function useJobStatus(jobId) {
  const { data } = useReadContract({
    address: contracts.escrow,
    abi: JobEscrowABI,
    functionName: 'getJobStatus',
    args: [BigInt(jobId || 0)],
    enabled: jobId != null,
  })
  return data ? Number(data) : null
}

export function useCreateJob() {
  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState(null)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const createJob = async (agentTokenId, scope, memo, amountEth) => {
    const hash = await writeContractAsync({
      address: contracts.escrow,
      abi: JobEscrowABI,
      functionName: 'createJob',
      args: [BigInt(agentTokenId), scope, memo],
      value: parseEther(amountEth),
    })
    setTxHash(hash)
    return hash
  }

  return { createJob, isPending, isConfirming, isSuccess, txHash }
}

export function useCompleteJob() {
  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState(null)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const completeJob = async (jobId, rating) => {
    const hash = await writeContractAsync({
      address: contracts.escrow,
      abi: JobEscrowABI,
      functionName: 'completeJob',
      args: [BigInt(jobId), rating],
    })
    setTxHash(hash)
    return hash
  }

  return { completeJob, isPending, isConfirming, isSuccess }
}

export function useRejectJob() {
  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState(null)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const rejectJob = async (jobId, reason) => {
    const hash = await writeContractAsync({
      address: contracts.escrow,
      abi: JobEscrowABI,
      functionName: 'rejectJob',
      args: [BigInt(jobId), reason],
    })
    setTxHash(hash)
    return hash
  }

  return { rejectJob, isPending, isConfirming, isSuccess }
}

// ─── FeedbackSystem hooks ───────────────────────────────────

export function useAgentFeedback(tokenId) {
  const { data } = useReadContract({
    address: contracts.feedback,
    abi: FeedbackSystemABI,
    functionName: 'getFeedback',
    args: [BigInt(tokenId || 0)],
    enabled: tokenId != null,
  })

  if (!data || data.length === 0) return { feedbacks: [], avgRating: 0, count: 0 }

  const feedbacks = data.map((f) => ({
    reviewer: f.reviewer,
    rating: Number(f.rating),
    commentHash: f.commentHash,
    commentURI: f.commentURI,
    timestamp: Number(f.timestamp),
    jobId: Number(f.jobId),
  }))

  const avgRating = feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
  return { feedbacks, avgRating, count: feedbacks.length }
}

export function useSubmitFeedback() {
  const { writeContractAsync, isPending } = useWriteContract()
  const [txHash, setTxHash] = useState(null)
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const submitFeedback = async (agentTokenId, rating, commentHash, commentURI, jobId) => {
    const hash = await writeContractAsync({
      address: contracts.feedback,
      abi: FeedbackSystemABI,
      functionName: 'submitFeedback',
      args: [BigInt(agentTokenId), rating, commentHash, commentURI, BigInt(jobId)],
    })
    setTxHash(hash)
    return hash
  }

  return { submitFeedback, isPending, isConfirming, isSuccess }
}
