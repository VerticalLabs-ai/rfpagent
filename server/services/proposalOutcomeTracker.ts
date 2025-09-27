import { storage } from "../storage"
import { agentMemoryService } from "./agentMemoryService"
import { selfImprovingLearningService } from "./selfImprovingLearningService"

/**
 * Proposal Outcome Tracker Service
 *
 * Tracks proposal submissions through their entire lifecycle and learns from outcomes.
 * Integrates with the self-improving learning system to continuously enhance proposal strategies.
 */

export interface ProposalOutcome {
  id?: string
  proposalId: string
  rfpId: string
  submissionId?: string
  status:
    | "submitted"
    | "under_review"
    | "rejected"
    | "awarded"
    | "lost"
    | "withdrawn"
  outcomeDetails: {
    awardDate?: Date
    rejectionReason?: string
    score?: number
    feedback?: string
    competitorInfo?: {
      winningBidder?: string
      winningAmount?: number
      totalBidders?: number
    }
    evaluationCriteria?: {
      technical?: number
      price?: number
      experience?: number
      overall?: number
    }
  }
  learningData: {
    strategiesUsed: any
    marketConditions: any
    competitiveFactors: any
    internalFactors: any
  }
  followUpActions?: string[]
  timestamp: Date
}

export interface BiddingCompetition {
  rfpId: string
  agency: string
  estimatedValue: number
  actualValue?: number
  totalBidders: number
  bidders: Array<{
    name: string
    bidAmount?: number
    isWinner: boolean
    isUs: boolean
  }>
  marketAnalysis: {
    competitiveness: "low" | "medium" | "high"
    priceVariance: number
    strategicImportance: "low" | "medium" | "high"
  }
}

export class ProposalOutcomeTracker {
  private static instance: ProposalOutcomeTracker
  private outcomePollInterval: number = 7 * 24 * 60 * 60 * 1000 // 7 days
  private followUpEnabled: boolean = true

  public static getInstance(): ProposalOutcomeTracker {
    if (!ProposalOutcomeTracker.instance) {
      ProposalOutcomeTracker.instance = new ProposalOutcomeTracker()
    }
    return ProposalOutcomeTracker.instance
  }

  // ============ OUTCOME TRACKING ============

  /**
   * Record a proposal outcome and trigger learning
   */
  async recordProposalOutcome(outcome: ProposalOutcome): Promise<void> {
    try {
      console.log(
        `📊 Recording proposal outcome: ${outcome.status} for proposal ${outcome.proposalId}`
      )

      // Store outcome in database
      await this.storeOutcome(outcome)

      // Get related proposal and RFP data
      const proposal = await storage.getProposal(outcome.proposalId)
      const rfp = await storage.getRFP(outcome.rfpId)

      if (!proposal || !rfp) {
        console.error("❌ Could not find proposal or RFP for outcome tracking")
        return
      }

      // Create learning outcome for the self-improving system
      const learningOutcome = await this.createLearningOutcome(
        outcome,
        proposal,
        rfp
      )

      // Record learning outcome
      await selfImprovingLearningService.recordLearningOutcome(learningOutcome)

      // Update RFP status based on outcome
      await this.updateRFPStatus(rfp, outcome.status)

      // Generate follow-up actions if enabled
      if (this.followUpEnabled) {
        await this.generateFollowUpActions(outcome, proposal, rfp)
      }

      // Update competitive intelligence if we have competitor data
      if (outcome.outcomeDetails.competitorInfo) {
        await this.updateCompetitiveIntelligence(rfp, outcome)
      }

      console.log(
        `✅ Proposal outcome recorded and learning triggered for ${outcome.proposalId}`
      )
    } catch (error) {
      console.error("❌ Failed to record proposal outcome:", error)
    }
  }

  /**
   * Track proposal through its lifecycle
   */
  async trackProposalStatus(
    proposalId: string
  ): Promise<ProposalOutcome | null> {
    try {
      const proposal = await storage.getProposal(proposalId)
      if (!proposal) return null

      const submission = await storage.getSubmissionByProposal(proposalId)
      if (!submission) return null

      // Check if we already have an outcome for this proposal
      const existingOutcome = await this.getProposalOutcome(proposalId)
      if (
        existingOutcome &&
        existingOutcome.status !== "submitted" &&
        existingOutcome.status !== "under_review"
      ) {
        return existingOutcome
      }

      // Poll for outcome updates (this would integrate with portal monitoring)
      const outcomeData = await this.pollForOutcome(submission)

      if (outcomeData) {
        const outcome: ProposalOutcome = {
          proposalId,
          rfpId: proposal.rfpId,
          submissionId: submission.id,
          status: outcomeData.status,
          outcomeDetails: outcomeData.details,
          learningData: {
            strategiesUsed: this.extractStrategiesUsed(proposal),
            marketConditions: await this.analyzeMarketConditions(
              proposal.rfpId
            ),
            competitiveFactors: outcomeData.competitiveFactors || {},
            internalFactors: this.analyzeInternalFactors(proposal),
          },
          timestamp: new Date(),
        }

        await this.recordProposalOutcome(outcome)
        return outcome
      }

      return null
    } catch (error) {
      console.error("❌ Failed to track proposal status:", error)
      return null
    }
  }

  /**
   * Analyze proposal performance patterns
   */
  async analyzeProposalPerformance(
    timeframe: "week" | "month" | "quarter" | "year" = "month"
  ): Promise<any> {
    try {
      const endDate = new Date()
      const startDate = new Date()

      switch (timeframe) {
        case "week":
          startDate.setDate(endDate.getDate() - 7)
          break
        case "month":
          startDate.setMonth(endDate.getMonth() - 1)
          break
        case "quarter":
          startDate.setMonth(endDate.getMonth() - 3)
          break
        case "year":
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
      }

      const outcomes = await this.getOutcomesByDateRange(startDate, endDate)

      const analysis = {
        totalProposals: outcomes.length,
        winRate: this.calculateWinRate(outcomes),
        averageScore: this.calculateAverageScore(outcomes),
        performanceByAgency: this.analyzePerformanceByAgency(outcomes),
        performanceByCategory: this.analyzePerformanceByCategory(outcomes),
        trendAnalysis: this.analyzeTrends(outcomes),
        improvementAreas: await this.identifyImprovementAreas(outcomes),
        recommendations: await this.generateRecommendations(outcomes),
      }

      return analysis
    } catch (error) {
      console.error("❌ Failed to analyze proposal performance:", error)
      return null
    }
  }

  // ============ COMPETITIVE INTELLIGENCE ============

  /**
   * Update competitive intelligence based on bid outcomes
   */
  async updateCompetitiveIntelligence(
    rfp: any,
    outcome: ProposalOutcome
  ): Promise<void> {
    const competitorInfo = outcome.outcomeDetails.competitorInfo
    if (!competitorInfo) return

    try {
      // Store competitive data
      const competitionData: BiddingCompetition = {
        rfpId: rfp.id,
        agency: rfp.agency,
        estimatedValue: rfp.estimatedValue || 0,
        actualValue: competitorInfo.winningAmount,
        totalBidders: competitorInfo.totalBidders || 1,
        bidders: [
          {
            name: "Our Company",
            bidAmount: this.extractOurBidAmount(outcome),
            isWinner: outcome.status === "awarded",
            isUs: true,
          },
        ],
        marketAnalysis: {
          competitiveness: this.assessCompetitiveness(
            competitorInfo.totalBidders || 1
          ),
          priceVariance: this.calculatePriceVariance(
            rfp.estimatedValue,
            competitorInfo.winningAmount
          ),
          strategicImportance: this.assessStrategicImportance(rfp),
        },
      }

      // Add winner info if available
      if (
        competitorInfo.winningBidder &&
        competitorInfo.winningBidder !== "Our Company"
      ) {
        competitionData.bidders.push({
          name: competitorInfo.winningBidder,
          bidAmount: competitorInfo.winningAmount,
          isWinner: true,
          isUs: false,
        })
      }

      // Store as knowledge for future bidding decisions
      await agentMemoryService.storeKnowledge({
        agentId: "market-research-analyst",
        knowledgeType: "market_insight",
        domain: rfp.agency,
        title: `Competition Analysis: ${rfp.title}`,
        description: `Competitive intelligence from ${rfp.agency} bidding`,
        content: competitionData,
        confidenceScore: 0.8,
        sourceType: "experience",
        sourceId: rfp.id,
        tags: ["competition", "bidding", rfp.agency],
      })

      console.log(`🎯 Updated competitive intelligence for ${rfp.agency}`)
    } catch (error) {
      console.error("❌ Failed to update competitive intelligence:", error)
    }
  }

  /**
   * Get competitive insights for bidding strategy
   */
  async getCompetitiveInsights(
    agency: string,
    category?: string
  ): Promise<any> {
    try {
      // Get historical competitive data
      const insights = await agentMemoryService.getAgentKnowledge(
        "market-research-analyst",
        "market_insight",
        agency,
        20
      )

      const competitionData = insights
        .map((insight) => JSON.parse(insight.content as string))
        .filter((content) => content.bidders && content.totalBidders)

      if (competitionData.length === 0) {
        return {
          agency,
          hasData: false,
          recommendations: [
            "Insufficient historical data - proceed with conservative strategy",
          ],
        }
      }

      const analysis = {
        agency,
        hasData: true,
        totalRFPs: competitionData.length,
        averageBidders:
          competitionData.reduce((sum, data) => sum + data.totalBidders, 0) /
          competitionData.length,
        winRate: this.calculateAgencyWinRate(competitionData),
        competitivenessLevel:
          this.calculateAverageCompetitiveness(competitionData),
        pricingInsights: {
          averagePriceVariance:
            this.calculateAveragePriceVariance(competitionData),
          pricingStrategy: this.suggestPricingStrategy(competitionData),
        },
        commonCompetitors: this.identifyCommonCompetitors(competitionData),
        recommendations: this.generateBiddingRecommendations(competitionData),
      }

      return analysis
    } catch (error) {
      console.error("❌ Failed to get competitive insights:", error)
      return { agency, hasData: false, error: error.message }
    }
  }

  // ============ FOLLOW-UP ACTIONS ============

  /**
   * Generate follow-up actions based on outcome
   */
  async generateFollowUpActions(
    outcome: ProposalOutcome,
    proposal: any,
    rfp: any
  ): Promise<void> {
    const actions = []

    switch (outcome.status) {
      case "awarded":
        actions.push("Send thank you message to client")
        actions.push("Begin project transition planning")
        actions.push("Document winning strategy for future use")
        actions.push("Analyze why this proposal won for pattern learning")
        break

      case "rejected":
      case "lost":
        actions.push("Request detailed feedback from client")
        actions.push("Analyze competitor advantages")
        actions.push("Update bidding strategy based on loss")
        actions.push("Consider relationship building opportunities")
        break

      case "under_review":
        actions.push("Monitor review process and timeline")
        actions.push("Prepare for potential follow-up questions")
        actions.push("Research decision makers and process")
        break
    }

    // Store follow-up actions
    outcome.followUpActions = actions

    // Create work items for critical follow-ups
    if (outcome.status === "lost" || outcome.status === "rejected") {
      await this.createFeedbackRequestWorkItem(outcome, rfp)
    }

    // Create notification for team
    await storage.createNotification({
      type: outcome.status === "awarded" ? "approval" : "compliance",
      title: `Proposal ${outcome.status}: ${rfp.title}`,
      message: `Follow-up actions generated: ${actions.join(", ")}`,
      relatedEntityType: "proposal",
      relatedEntityId: outcome.proposalId,
    })
  }

  /**
   * Create work item to request feedback from lost proposals
   */
  async createFeedbackRequestWorkItem(
    outcome: ProposalOutcome,
    rfp: any
  ): Promise<void> {
    try {
      await storage.createWorkItem({
        sessionId: "system-generated",
        taskType: "feedback_request",
        inputs: {
          proposalId: outcome.proposalId,
          rfpId: outcome.rfpId,
          agency: rfp.agency,
          contactInfo: rfp.contactInfo,
          outcomeDetails: outcome.outcomeDetails,
        },
        expectedOutputs: ["client_feedback", "improvement_insights"],
        priority: 7, // High priority for learning
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days
        createdByAgentId: "proposal-outcome-tracker",
        metadata: {
          type: "learning_opportunity",
          category: "feedback_collection",
        },
      })

      console.log(
        `📝 Created feedback request work item for lost proposal: ${outcome.proposalId}`
      )
    } catch (error) {
      console.error("❌ Failed to create feedback request work item:", error)
    }
  }

  // ============ PRIVATE HELPER METHODS ============

  private async createLearningOutcome(
    outcome: ProposalOutcome,
    proposal: any,
    rfp: any
  ): Promise<any> {
    return {
      type:
        outcome.status === "awarded" ? "proposal_success" : "proposal_failure",
      rfpId: rfp.id,
      agentId: "proposal-generation-specialist",
      context: {
        action: "proposal_submission",
        strategy: outcome.learningData.strategiesUsed,
        conditions: outcome.learningData.marketConditions,
        inputs: {
          rfpType: this.categorizeRFP(rfp),
          agency: rfp.agency,
          estimatedValue: rfp.estimatedValue,
          proposalContent: proposal.content,
        },
        expectedOutput: "win_contract",
        actualOutput: outcome.status,
      },
      outcome: {
        success: outcome.status === "awarded",
        metrics: {
          score: outcome.outcomeDetails.score,
          duration: this.calculateProposalDuration(proposal),
          competitiveness:
            outcome.outcomeDetails.competitorInfo?.totalBidders || 1,
        },
        feedback:
          outcome.outcomeDetails.feedback ||
          outcome.outcomeDetails.rejectionReason,
        errorDetails:
          outcome.status !== "awarded"
            ? {
                type: "proposal_rejected",
                message:
                  outcome.outcomeDetails.rejectionReason ||
                  "Proposal not selected",
              }
            : undefined,
        improvementAreas: this.identifyProposalImprovementAreas(outcome),
      },
      learnedPatterns: this.extractLearnedPatterns(outcome, proposal, rfp),
      adaptations: this.suggestAdaptations(outcome, proposal, rfp),
      confidenceScore: this.calculateOutcomeConfidence(outcome),
      domain: rfp.agency,
      category: this.categorizeRFP(rfp),
      timestamp: outcome.timestamp,
    }
  }

  private extractStrategiesUsed(proposal: any): any {
    return {
      contentApproach: {
        narrativeStyle:
          proposal.narratives?.length > 0 ? "detailed" : "standard",
        technicalDepth: this.assessTechnicalDepth(proposal.content),
        structuralApproach: this.analyzeProposalStructure(proposal),
      },
      pricingStrategy: {
        margin: proposal.estimatedMargin || 0.15,
        approach: this.determinePricingApproach(proposal),
        competitiveness: this.assessPricingCompetitiveness(proposal),
      },
      complianceStrategy: {
        thoroughness: proposal.metadata?.complianceScore || 0.8,
        riskMitigation: this.assessRiskMitigation(proposal),
      },
    }
  }

  private async analyzeMarketConditions(rfpId: string): Promise<any> {
    const rfp = await storage.getRFP(rfpId)
    const historicalBids = await storage.getHistoricalBidsByAgency(rfp.agency)

    return {
      agencyHistory: historicalBids.length,
      averageCompetition: this.calculateAverageCompetition(historicalBids),
      marketTrends: this.analyzeMarketTrends(historicalBids),
      seasonality: this.analyzeSeasonality(rfp.deadline),
    }
  }

  private analyzeInternalFactors(proposal: any): any {
    return {
      resourceUtilization: "optimal", // Would be calculated from actual resource data
      teamExperience: this.assessTeamExperience(proposal),
      timeAllocation: this.calculateTimeAllocation(proposal),
      qualityMetrics: {
        complianceScore: proposal.metadata?.complianceScore || 0.8,
        contentQuality: proposal.metadata?.qualityScore || 0.8,
      },
    }
  }

  private async pollForOutcome(submission: any): Promise<any | null> {
    // This would integrate with portal monitoring to check for outcome updates
    // For now, return null to indicate no new outcome data
    // In a real implementation, this would:
    // 1. Check the portal for submission status updates
    // 2. Parse award announcements
    // 3. Monitor for feedback or rejection notices

    return null
  }

  private async storeOutcome(outcome: ProposalOutcome): Promise<void> {
    // Store outcome in agent memory for persistence
    await agentMemoryService.storeMemory({
      agentId: "proposal-outcome-tracker",
      memoryType: "episodic",
      contextKey: `outcome_${outcome.proposalId}`,
      title: `Proposal Outcome: ${outcome.status}`,
      content: outcome,
      importance: outcome.status === "awarded" ? 9 : 8,
      tags: [outcome.status, "proposal_outcome"],
      metadata: {
        proposalId: outcome.proposalId,
        rfpId: outcome.rfpId,
        timestamp: outcome.timestamp,
      },
    })
  }

  private async getProposalOutcome(
    proposalId: string
  ): Promise<ProposalOutcome | null> {
    const memory = await agentMemoryService.getMemoryByContext(
      "proposal-outcome-tracker",
      `outcome_${proposalId}`
    )
    return memory ? (memory.content as ProposalOutcome) : null
  }

  private async getOutcomesByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ProposalOutcome[]> {
    const memories = await agentMemoryService.getAgentMemories(
      "proposal-outcome-tracker",
      "episodic",
      1000
    )

    return memories
      .filter((m) => {
        const timestamp = new Date(m.content.timestamp)
        return timestamp >= startDate && timestamp <= endDate
      })
      .map((m) => m.content)
  }

  private calculateWinRate(outcomes: ProposalOutcome[]): number {
    if (outcomes.length === 0) return 0
    const wins = outcomes.filter((o) => o.status === "awarded").length
    return wins / outcomes.length
  }

  private calculateAverageScore(outcomes: ProposalOutcome[]): number {
    const scoresAvailable = outcomes.filter(
      (o) => o.outcomeDetails.score !== undefined
    )
    if (scoresAvailable.length === 0) return 0

    const totalScore = scoresAvailable.reduce(
      (sum, o) => sum + (o.outcomeDetails.score || 0),
      0
    )
    return totalScore / scoresAvailable.length
  }

  private analyzePerformanceByAgency(outcomes: ProposalOutcome[]): any {
    const agencyGroups = outcomes.reduce((groups, outcome) => {
      // Get agency from RFP data (would need to fetch RFP)
      const agency = "unknown" // Placeholder
      if (!groups[agency]) groups[agency] = []
      groups[agency].push(outcome)
      return groups
    }, {})

    const analysis = {}
    for (const [agency, agencyOutcomes] of Object.entries(agencyGroups)) {
      analysis[agency] = {
        totalProposals: (agencyOutcomes as ProposalOutcome[]).length,
        winRate: this.calculateWinRate(agencyOutcomes as ProposalOutcome[]),
        averageScore: this.calculateAverageScore(
          agencyOutcomes as ProposalOutcome[]
        ),
      }
    }

    return analysis
  }

  private analyzePerformanceByCategory(outcomes: ProposalOutcome[]): any {
    // Similar to analyzePerformanceByAgency but group by RFP category
    return {}
  }

  private analyzeTrends(outcomes: ProposalOutcome[]): any {
    // Sort by timestamp and analyze trends over time
    const sortedOutcomes = outcomes.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    )

    // Calculate monthly win rates
    const monthlyData = {}
    for (const outcome of sortedOutcomes) {
      const month = outcome.timestamp.toISOString().substring(0, 7) // YYYY-MM
      if (!monthlyData[month]) monthlyData[month] = { total: 0, wins: 0 }
      monthlyData[month].total++
      if (outcome.status === "awarded") monthlyData[month].wins++
    }

    const trends = Object.entries(monthlyData).map(
      ([month, data]: [string, any]) => ({
        month,
        winRate: data.wins / data.total,
        totalProposals: data.total,
      })
    )

    return trends
  }

  private async identifyImprovementAreas(
    outcomes: ProposalOutcome[]
  ): Promise<string[]> {
    const areas = []
    const lostProposals = outcomes.filter(
      (o) => o.status === "rejected" || o.status === "lost"
    )

    if (lostProposals.length > outcomes.length * 0.5) {
      areas.push("Overall win rate needs improvement")
    }

    // Analyze feedback patterns
    const feedbackPatterns = lostProposals
      .map((o) => o.outcomeDetails.feedback || o.outcomeDetails.rejectionReason)
      .filter(Boolean)

    if (feedbackPatterns.some((f) => f.toLowerCase().includes("price"))) {
      areas.push("Pricing strategy may need adjustment")
    }

    if (feedbackPatterns.some((f) => f.toLowerCase().includes("technical"))) {
      areas.push("Technical approach could be strengthened")
    }

    return areas
  }

  private async generateRecommendations(
    outcomes: ProposalOutcome[]
  ): Promise<string[]> {
    const recommendations = []
    const winRate = this.calculateWinRate(outcomes)

    if (winRate < 0.3) {
      recommendations.push(
        "Consider fundamental strategy review - win rate is below industry average"
      )
    } else if (winRate < 0.5) {
      recommendations.push(
        "Focus on improving proposal quality and competitive positioning"
      )
    }

    const averageScore = this.calculateAverageScore(outcomes)
    if (averageScore > 0 && averageScore < 70) {
      recommendations.push(
        "Work on improving proposal scores through better requirement addressing"
      )
    }

    return recommendations
  }

  private extractOurBidAmount(outcome: ProposalOutcome): number {
    // Extract our bid amount from proposal data
    return (
      outcome.learningData.strategiesUsed?.pricingStrategy?.totalAmount || 0
    )
  }

  private assessCompetitiveness(
    totalBidders: number
  ): "low" | "medium" | "high" {
    if (totalBidders <= 3) return "low"
    if (totalBidders <= 6) return "medium"
    return "high"
  }

  private calculatePriceVariance(estimated: number, actual: number): number {
    if (!estimated || !actual) return 0
    return Math.abs(actual - estimated) / estimated
  }

  private assessStrategicImportance(rfp: any): "low" | "medium" | "high" {
    const value = rfp.estimatedValue || 0
    if (value > 1000000) return "high"
    if (value > 100000) return "medium"
    return "low"
  }

  private calculateAgencyWinRate(competitionData: any[]): number {
    const ourWins = competitionData.filter((data) =>
      data.bidders.some((bidder) => bidder.isUs && bidder.isWinner)
    ).length

    return competitionData.length > 0 ? ourWins / competitionData.length : 0
  }

  private calculateAverageCompetitiveness(competitionData: any[]): string {
    const levels = competitionData.map(
      (data) => data.marketAnalysis.competitiveness
    )
    const counts = levels.reduce((acc, level) => {
      acc[level] = (acc[level] || 0) + 1
      return acc
    }, {})

    return Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b))
  }

  private calculateAveragePriceVariance(competitionData: any[]): number {
    const variances = competitionData
      .map((data) => data.marketAnalysis.priceVariance)
      .filter((v) => v !== undefined)

    return variances.length > 0
      ? variances.reduce((sum, v) => sum + v, 0) / variances.length
      : 0
  }

  private suggestPricingStrategy(competitionData: any[]): string {
    const avgVariance = this.calculateAveragePriceVariance(competitionData)
    const winRate = this.calculateAgencyWinRate(competitionData)

    if (winRate < 0.3 && avgVariance > 0.1) {
      return "Consider more aggressive pricing - current approach may be too conservative"
    } else if (winRate > 0.7) {
      return "Current pricing strategy appears effective - maintain approach"
    } else {
      return "Moderate adjustment needed - analyze specific competitor patterns"
    }
  }

  private identifyCommonCompetitors(competitionData: any[]): string[] {
    const competitors = competitionData
      .flatMap((data) => data.bidders.filter((b) => !b.isUs).map((b) => b.name))
      .filter(Boolean)

    const counts = competitors.reduce((acc, competitor) => {
      acc[competitor] = (acc[competitor] || 0) + 1
      return acc
    }, {})

    return Object.entries(counts)
      .filter(([_, count]) => (count as number) > 1)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([competitor, _]) => competitor)
  }

  private generateBiddingRecommendations(competitionData: any[]): string[] {
    const recommendations = []
    const winRate = this.calculateAgencyWinRate(competitionData)
    const avgCompetitors =
      competitionData.reduce((sum, data) => sum + data.totalBidders, 0) /
      competitionData.length

    if (avgCompetitors > 6) {
      recommendations.push(
        "High competition environment - focus on differentiation and value proposition"
      )
    }

    if (winRate < 0.3) {
      recommendations.push("Low win rate suggests need for strategy revision")
    }

    const commonCompetitors = this.identifyCommonCompetitors(competitionData)
    if (commonCompetitors.length > 0) {
      recommendations.push(
        `Focus on competitive analysis of: ${commonCompetitors
          .slice(0, 3)
          .join(", ")}`
      )
    }

    return recommendations
  }

  private categorizeRFP(rfp: any): string {
    const title = (rfp.title || "").toLowerCase()
    if (
      title.includes("technology") ||
      title.includes("software") ||
      title.includes("it")
    )
      return "technology"
    if (title.includes("construction") || title.includes("building"))
      return "construction"
    if (title.includes("consulting") || title.includes("advisory"))
      return "consulting"
    return "general"
  }

  private calculateProposalDuration(proposal: any): number {
    const generated = new Date(proposal.generatedAt)
    const submitted = new Date(proposal.updatedAt)
    return submitted.getTime() - generated.getTime()
  }

  private identifyProposalImprovementAreas(outcome: ProposalOutcome): string[] {
    const areas = []

    if (outcome.outcomeDetails.evaluationCriteria) {
      const criteria = outcome.outcomeDetails.evaluationCriteria
      if (criteria.technical && criteria.technical < 70)
        areas.push("technical_approach")
      if (criteria.price && criteria.price < 70) areas.push("pricing_strategy")
      if (criteria.experience && criteria.experience < 70)
        areas.push("qualifications")
    }

    if (outcome.outcomeDetails.rejectionReason) {
      const reason = outcome.outcomeDetails.rejectionReason.toLowerCase()
      if (reason.includes("price")) areas.push("pricing_competitiveness")
      if (reason.includes("technical")) areas.push("technical_solution")
      if (reason.includes("experience")) areas.push("past_performance")
    }

    return areas
  }

  private extractLearnedPatterns(
    outcome: ProposalOutcome,
    proposal: any,
    rfp: any
  ): string[] {
    const patterns = []

    if (outcome.status === "awarded") {
      patterns.push(`successful_strategy_${rfp.agency}`)
      patterns.push(`winning_approach_${this.categorizeRFP(rfp)}`)
    } else {
      patterns.push(`failed_strategy_${rfp.agency}`)
      if (outcome.outcomeDetails.rejectionReason) {
        patterns.push(
          `rejection_pattern_${outcome.outcomeDetails.rejectionReason
            .toLowerCase()
            .replace(/\s+/g, "_")}`
        )
      }
    }

    return patterns
  }

  private suggestAdaptations(
    outcome: ProposalOutcome,
    proposal: any,
    rfp: any
  ): any[] {
    const adaptations = []

    if (outcome.status !== "awarded") {
      adaptations.push({
        type: "strategy_adjustment",
        area: "overall_approach",
        suggestion:
          "Review and update proposal generation strategy based on outcome",
        confidence: 0.7,
      })

      if (outcome.outcomeDetails.evaluationCriteria?.price < 70) {
        adaptations.push({
          type: "pricing_adjustment",
          area: "pricing_strategy",
          suggestion: "Consider more competitive pricing approach",
          confidence: 0.8,
        })
      }
    }

    return adaptations
  }

  private calculateOutcomeConfidence(outcome: ProposalOutcome): number {
    let confidence = 0.5

    // Increase confidence if we have detailed feedback
    if (outcome.outcomeDetails.feedback) confidence += 0.2
    if (outcome.outcomeDetails.evaluationCriteria) confidence += 0.2
    if (outcome.outcomeDetails.competitorInfo) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  private updateRFPStatus(rfp: any, outcomeStatus: string): Promise<any> {
    let rfpStatus = rfp.status

    switch (outcomeStatus) {
      case "awarded":
        rfpStatus = "won"
        break
      case "rejected":
      case "lost":
        rfpStatus = "lost"
        break
      case "withdrawn":
        rfpStatus = "withdrawn"
        break
    }

    return storage.updateRFP(rfp.id, { status: rfpStatus })
  }

  private assessTechnicalDepth(content: any): string {
    if (!content) return "basic"
    const contentStr = JSON.stringify(content).toLowerCase()
    const technicalTerms = [
      "architecture",
      "methodology",
      "framework",
      "implementation",
    ]
    const matches = technicalTerms.filter((term) => contentStr.includes(term))
    return matches.length > 2
      ? "deep"
      : matches.length > 0
      ? "moderate"
      : "basic"
  }

  private analyzeProposalStructure(proposal: any): any {
    return {
      sections: proposal.narratives?.length || 0,
      hasExecutiveSummary: !!proposal.content?.executive_summary,
      hasTechnicalApproach: !!proposal.content?.technical_approach,
      hasQualifications: !!proposal.content?.qualifications,
      attachmentCount: proposal.attachments?.length || 0,
    }
  }

  private determinePricingApproach(proposal: any): string {
    const margin = proposal.estimatedMargin || 0.15
    if (margin < 0.1) return "aggressive"
    if (margin > 0.2) return "conservative"
    return "competitive"
  }

  private assessPricingCompetitiveness(proposal: any): string {
    // This would compare against market rates
    return "moderate"
  }

  private assessRiskMitigation(proposal: any): string {
    const hasRiskSection = !!proposal.content?.risk_mitigation
    const hasContingency = !!proposal.content?.contingency_plans

    if (hasRiskSection && hasContingency) return "comprehensive"
    if (hasRiskSection || hasContingency) return "basic"
    return "minimal"
  }

  private calculateAverageCompetition(historicalBids: any[]): number {
    // Calculate average number of bidders from historical data
    return historicalBids.length > 0 ? 4 : 3 // Default estimate
  }

  private analyzeMarketTrends(historicalBids: any[]): any {
    return {
      bidFrequency: historicalBids.length,
      averageValue:
        historicalBids.reduce((sum, bid) => sum + (bid.bidAmount || 0), 0) /
        Math.max(historicalBids.length, 1),
      trend: "stable", // Would analyze actual trends
    }
  }

  private analyzeSeasonality(deadline: Date): string {
    const month = deadline.getMonth()
    if (month >= 8 && month <= 11) return "fiscal_year_end" // Sept-Dec
    if (month >= 5 && month <= 7) return "summer_season" // Jun-Aug
    return "regular"
  }

  private assessTeamExperience(proposal: any): string {
    // Would assess based on team qualifications in proposal
    return "experienced"
  }

  private calculateTimeAllocation(proposal: any): any {
    return {
      preparationTime: "adequate",
      resourcesAllocated: "optimal",
      rushStatus: "normal",
    }
  }
}

export const proposalOutcomeTracker = ProposalOutcomeTracker.getInstance()
