import { randomUUID } from 'crypto';
import { and, avg, count, eq, gte, lte, sql, sum } from 'drizzle-orm';
import { z } from 'zod';
import {
  agentKnowledgeBase,
  agentMemory,
  agentPerformanceMetrics,
  documents,
  proposals,
  scans,
} from '@shared/schema';
import { db } from '../../db';

// Schemas for monitoring data structures
const MetricTrendSchema = z.object({
  metricName: z.string(),
  timeframe: z.enum(['hour', 'day', 'week', 'month']),
  currentValue: z.number(),
  previousValue: z.number(),
  changePercent: z.number(),
  trend: z.enum(['improving', 'declining', 'stable']),
  significance: z.enum(['low', 'medium', 'high']),
  context: z.any().optional() as any,
});

const PerformanceDashboardSchema = z.object({
  timestamp: z.string(),
  systemHealth: z.object({
    overall: z.number().min(0).max(100),
    components: z.record(z.string(), z.number().min(0).max(100)),
  }),
  learningMetrics: z.object({
    totalLearningEvents: z.number(),
    learningRate: z.number(),
    knowledgeGrowth: z.number(),
    adaptationSuccess: z.number(),
  }),
  performanceMetrics: z.object({
    proposalWinRate: z.number(),
    parsingAccuracy: z.number(),
    portalNavigationSuccess: z.number(),
    documentProcessingTime: z.number(),
  }),
  improvementOpportunities: z.array(
    z.object({
      component: z.string(),
      opportunity: z.string(),
      impact: z.enum(['low', 'medium', 'high']),
      effort: z.enum(['low', 'medium', 'high']),
      recommendation: z.string(),
    })
  ),
  alerts: z.array(
    z.object({
      severity: z.enum(['info', 'warning', 'critical']),
      component: z.string(),
      message: z.string(),
      timestamp: z.string(),
      actionRequired: z.boolean(),
    })
  ),
});

const ImprovementPlanSchema = z.object({
  planId: z.string(),
  title: z.string(),
  description: z.string(),
  targetMetrics: z.array(
    z.object({
      metricName: z.string(),
      currentValue: z.number(),
      targetValue: z.number(),
      timeframe: z.string(),
    })
  ),
  actions: z.array(
    z.object({
      actionId: z.string(),
      description: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      estimatedImpact: z.number(),
      status: z.enum(['planned', 'in_progress', 'completed', 'cancelled']),
      assignedComponent: z.string(),
    })
  ),
  timeline: z.object({
    startDate: z.string(),
    targetDate: z.string(),
    milestones: z.array(
      z.object({
        date: z.string(),
        description: z.string(),
        completed: z.boolean(),
      })
    ),
  }),
  riskAssessment: z.object({
    risks: z.array(
      z.object({
        description: z.string(),
        probability: z.enum(['low', 'medium', 'high']),
        impact: z.enum(['low', 'medium', 'high']),
        mitigation: z.string(),
      })
    ),
    overallRisk: z.enum(['low', 'medium', 'high']),
  }),
});

type MetricTrend = z.infer<typeof MetricTrendSchema>;
type PerformanceDashboard = z.infer<typeof PerformanceDashboardSchema>;
type ImprovementPlan = z.infer<typeof ImprovementPlanSchema>;

export class ContinuousImprovementMonitor {
  private alertThresholds = {
    proposalWinRate: { warning: 0.15, critical: 0.1 },
    parsingAccuracy: { warning: 0.85, critical: 0.75 },
    portalNavigationSuccess: { warning: 0.8, critical: 0.7 },
    learningRate: { warning: 0.05, critical: 0.02 },
    systemHealth: { warning: 70, critical: 50 },
  };

  private improvementTargets = {
    proposalWinRate: 0.25,
    parsingAccuracy: 0.95,
    portalNavigationSuccess: 0.95,
    documentProcessingTime: 30, // seconds
    learningRate: 0.15,
    knowledgeGrowth: 0.2,
  };

  /**
   * Generate comprehensive performance dashboard
   */
  async generatePerformanceDashboard(
    timeframe: string = '7d'
  ): Promise<PerformanceDashboard> {
    const endDate = new Date();
    const startDate = new Date();

    // Calculate date range based on timeframe
    switch (timeframe) {
      case '1h':
        startDate.setHours(startDate.getHours() - 1);
        break;
      case '24h':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    try {
      // Gather all performance metrics
      const [
        systemHealth,
        learningMetrics,
        performanceMetrics,
        improvementOpportunities,
        alerts,
      ] = await Promise.all([
        this.calculateSystemHealth(startDate, endDate),
        this.calculateLearningMetrics(startDate, endDate),
        this.calculatePerformanceMetrics(startDate, endDate),
        this.identifyImprovementOpportunities(),
        this.generateAlerts(startDate, endDate),
      ]);

      const dashboard: PerformanceDashboard = {
        timestamp: new Date().toISOString(),
        systemHealth,
        learningMetrics,
        performanceMetrics,
        improvementOpportunities,
        alerts,
      };

      // Store dashboard snapshot for historical analysis
      await this.storeDashboardSnapshot(dashboard);

      return dashboard;
    } catch (error) {
      console.error('Error generating performance dashboard:', error);
      throw error;
    }
  }

  /**
   * Calculate overall system health score
   */
  private async calculateSystemHealth(
    startDate: Date,
    endDate: Date
  ): Promise<{
    overall: number;
    components: Record<string, number>;
  }> {
    try {
      // Query component health metrics
      const healthMetrics = await db
        .select({
          component: agentPerformanceMetrics.agentId,
          avgSuccess: avg(
            sql`CASE WHEN ${agentPerformanceMetrics.metricType} = 'task_completion' THEN ${agentPerformanceMetrics.metricValue} END`
          ),
          avgEfficiency: avg(
            sql`CASE WHEN ${agentPerformanceMetrics.metricType} = 'efficiency' THEN ${agentPerformanceMetrics.metricValue} END`
          ),
          errorCount: count(agentPerformanceMetrics.id),
        })
        .from(agentPerformanceMetrics)
        .where(
          and(
            gte(agentPerformanceMetrics.recordedAt, startDate),
            lte(agentPerformanceMetrics.recordedAt, endDate),
            sql`${agentPerformanceMetrics.metricType} IN ('task_completion', 'efficiency')`
          )
        )
        .groupBy(agentPerformanceMetrics.agentId);

      const components: Record<string, number> = {};
      let totalHealth = 0;
      let componentCount = 0;

      for (const metric of healthMetrics) {
        const successScore = (Number(metric.avgSuccess) || 0) * 40;
        const efficiencyScore = (Number(metric.avgEfficiency) || 0) * 40;
        const reliabilityScore = Math.max(
          0,
          20 - (Number(metric.errorCount) || 0)
        );

        const componentHealth = Math.min(
          100,
          successScore + efficiencyScore + reliabilityScore
        );
        components[metric.component || 'unknown'] = Math.round(componentHealth);

        totalHealth += componentHealth;
        componentCount++;
      }

      const overall =
        componentCount > 0 ? Math.round(totalHealth / componentCount) : 50;

      return { overall, components };
    } catch (error) {
      console.error('Error calculating system health:', error);
      return { overall: 50, components: {} };
    }
  }

  /**
   * Calculate learning effectiveness metrics
   */
  private async calculateLearningMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalLearningEvents: number;
    learningRate: number;
    knowledgeGrowth: number;
    adaptationSuccess: number;
  }> {
    try {
      // Count learning events
      const learningEvents = await db
        .select({ count: count() })
        .from(agentMemory)
        .where(
          and(
            gte(agentMemory.createdAt, startDate),
            lte(agentMemory.createdAt, endDate),
            eq(agentMemory.memoryType, 'episodic')
          )
        );

      // Calculate knowledge growth
      const knowledgeEntries = await db
        .select({ count: count() })
        .from(agentKnowledgeBase)
        .where(
          and(
            gte(agentKnowledgeBase.createdAt, startDate),
            lte(agentKnowledgeBase.createdAt, endDate)
          )
        );

      // Calculate adaptation success from performance improvements
      const adaptationMetrics = await db
        .select({
          avgImprovement: avg(agentPerformanceMetrics.metricValue),
        })
        .from(agentPerformanceMetrics)
        .where(
          and(
            gte(agentPerformanceMetrics.recordedAt, startDate),
            lte(agentPerformanceMetrics.recordedAt, endDate),
            eq(agentPerformanceMetrics.metricType, 'task_completion')
          )
        );

      const totalLearningEvents = Number(learningEvents[0]?.count) || 0;
      const knowledgeGrowth = Number(knowledgeEntries[0]?.count) || 0;
      const adaptationSuccess =
        Number(adaptationMetrics[0]?.avgImprovement) || 0;

      // Calculate learning rate (learning events per day)
      const daysDiff = Math.max(
        1,
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      );
      const learningRate = totalLearningEvents / daysDiff;

      return {
        totalLearningEvents,
        learningRate: Number(learningRate.toFixed(2)),
        knowledgeGrowth: Number((knowledgeGrowth / daysDiff).toFixed(2)),
        adaptationSuccess: Number((adaptationSuccess * 100).toFixed(2)),
      };
    } catch (error) {
      console.error('Error calculating learning metrics:', error);
      return {
        totalLearningEvents: 0,
        learningRate: 0,
        knowledgeGrowth: 0,
        adaptationSuccess: 0,
      };
    }
  }

  /**
   * Calculate key performance metrics
   */
  private async calculatePerformanceMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    proposalWinRate: number;
    parsingAccuracy: number;
    portalNavigationSuccess: number;
    documentProcessingTime: number;
  }> {
    try {
      // Calculate proposal win rate
      const proposalMetrics = await db
        .select({
          total: count(),
          won: sum(
            sql`CASE WHEN ${proposals.status} = 'approved' THEN 1 ELSE 0 END`
          ),
        })
        .from(proposals)
        .where(
          and(
            gte(proposals.generatedAt, startDate),
            lte(proposals.generatedAt, endDate)
          )
        );

      const totalProposals = Number(proposalMetrics[0]?.total) || 0;
      const wonProposals = Number(proposalMetrics[0]?.won) || 0;
      const proposalWinRate =
        totalProposals > 0 ? wonProposals / totalProposals : 0;

      // Calculate parsing accuracy from memory feedback
      const parsingMetrics = await db
        .select({
          avgAccuracy: avg(
            sql`CAST(${agentMemory.metadata}->>'accuracy' AS FLOAT)`
          ),
        })
        .from(agentMemory)
        .where(
          and(
            gte(agentMemory.createdAt, startDate),
            lte(agentMemory.createdAt, endDate),
            eq(agentMemory.memoryType, 'procedural'),
            sql`${agentMemory.metadata}->>'context' = 'document_parsing'`
          )
        );

      const parsingAccuracy = Number(parsingMetrics[0]?.avgAccuracy) || 0.85;

      // Calculate portal navigation success
      const portalMetrics = await db
        .select({
          total: count(),
          successful: sum(
            sql`CASE WHEN ${scans.status} = 'completed' THEN 1 ELSE 0 END`
          ),
        })
        .from(scans)
        .where(
          and(gte(scans.startedAt, startDate), lte(scans.startedAt, endDate))
        );

      const totalSessions = Number(portalMetrics[0]?.total) || 0;
      const successfulSessions = Number(portalMetrics[0]?.successful) || 0;
      const portalNavigationSuccess =
        totalSessions > 0 ? successfulSessions / totalSessions : 0;

      // Calculate average document processing time
      const processingMetrics = await db
        .select({
          avgProcessingTime: avg(
            sql`EXTRACT(EPOCH FROM (NOW() - ${documents.uploadedAt}))`
          ),
        })
        .from(documents)
        .where(
          and(
            gte(documents.uploadedAt, startDate),
            lte(documents.uploadedAt, endDate)
          )
        );

      const documentProcessingTime =
        Number(processingMetrics[0]?.avgProcessingTime) || 45;

      return {
        proposalWinRate: Number((proposalWinRate * 100).toFixed(2)),
        parsingAccuracy: Number((parsingAccuracy * 100).toFixed(2)),
        portalNavigationSuccess: Number(
          (portalNavigationSuccess * 100).toFixed(2)
        ),
        documentProcessingTime: Number(documentProcessingTime.toFixed(1)),
      };
    } catch (error) {
      console.error('Error calculating performance metrics:', error);
      return {
        proposalWinRate: 0,
        parsingAccuracy: 85,
        portalNavigationSuccess: 80,
        documentProcessingTime: 45,
      };
    }
  }

  /**
   * Identify improvement opportunities using AI analysis
   */
  private async identifyImprovementOpportunities(): Promise<
    Array<{
      component: string;
      opportunity: string;
      impact: 'low' | 'medium' | 'high';
      effort: 'low' | 'medium' | 'high';
      recommendation: string;
    }>
  > {
    try {
      // Analyze performance gaps
      const opportunities = [];

      // Query underperforming components
      const performanceGaps = await db
        .select({
          component: agentPerformanceMetrics.agentId,
          avgSuccess: avg(
            sql`CASE WHEN ${agentPerformanceMetrics.metricType} = 'task_completion' THEN ${agentPerformanceMetrics.metricValue} END`
          ),
          avgEfficiency: avg(
            sql`CASE WHEN ${agentPerformanceMetrics.metricType} = 'efficiency' THEN ${agentPerformanceMetrics.metricValue} END`
          ),
        })
        .from(agentPerformanceMetrics)
        .where(
          and(
            gte(
              agentPerformanceMetrics.recordedAt,
              new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            ),
            sql`${agentPerformanceMetrics.metricType} IN ('task_completion', 'efficiency')`
          )
        )
        .groupBy(agentPerformanceMetrics.agentId)
        .having(
          sql`AVG(CASE WHEN ${agentPerformanceMetrics.metricType} = 'task_completion' THEN ${agentPerformanceMetrics.metricValue} END) < 0.8`
        );

      for (const gap of performanceGaps) {
        const successRate = Number(gap.avgSuccess) || 0;
        const efficiency = Number(gap.avgEfficiency) || 0;

        if (successRate < 0.6) {
          opportunities.push({
            component: gap.component || 'unknown',
            opportunity: 'Critical performance improvement needed',
            impact: 'high' as const,
            effort: 'high' as const,
            recommendation: `Component ${gap.component} has success rate of ${(
              successRate * 100
            ).toFixed(
              1
            )}%. Requires immediate attention and possible architectural review.`,
          });
        } else if (successRate < 0.8) {
          opportunities.push({
            component: gap.component || 'unknown',
            opportunity: 'Performance optimization potential',
            impact: 'medium' as const,
            effort: 'medium' as const,
            recommendation: `Component ${gap.component} can be improved through targeted optimizations and additional training data.`,
          });
        }

        if (efficiency < 0.7) {
          opportunities.push({
            component: gap.component || 'unknown',
            opportunity: 'Efficiency enhancement opportunity',
            impact: 'medium' as const,
            effort: 'low' as const,
            recommendation: `Component ${gap.component} efficiency can be improved through caching, parallel processing, or algorithm optimization.`,
          });
        }
      }

      // Add general improvement opportunities
      opportunities.push({
        component: 'system',
        opportunity: 'Cross-component learning enhancement',
        impact: 'high' as const,
        effort: 'medium' as const,
        recommendation:
          'Implement knowledge sharing between components to accelerate learning and reduce redundant discoveries.',
      });

      return opportunities.slice(0, 10); // Limit to top 10 opportunities
    } catch (error) {
      console.error('Error identifying improvement opportunities:', error);
      return [];
    }
  }

  /**
   * Generate system alerts based on thresholds
   */
  private async generateAlerts(
    startDate: Date,
    endDate: Date
  ): Promise<
    Array<{
      severity: 'info' | 'warning' | 'critical';
      component: string;
      message: string;
      timestamp: string;
      actionRequired: boolean;
    }>
  > {
    const alerts = [];
    const now = new Date().toISOString();

    try {
      // Check performance metrics against thresholds
      const performanceMetrics = await this.calculatePerformanceMetrics(
        startDate,
        endDate
      );
      const systemHealth = await this.calculateSystemHealth(startDate, endDate);

      // Proposal win rate alerts
      if (
        performanceMetrics.proposalWinRate <
        this.alertThresholds.proposalWinRate.critical * 100
      ) {
        alerts.push({
          severity: 'critical' as const,
          component: 'proposal_generation',
          message: `Proposal win rate is critically low at ${performanceMetrics.proposalWinRate}%`,
          timestamp: now,
          actionRequired: true,
        });
      } else if (
        performanceMetrics.proposalWinRate <
        this.alertThresholds.proposalWinRate.warning * 100
      ) {
        alerts.push({
          severity: 'warning' as const,
          component: 'proposal_generation',
          message: `Proposal win rate is below target at ${performanceMetrics.proposalWinRate}%`,
          timestamp: now,
          actionRequired: true,
        });
      }

      // Parsing accuracy alerts
      if (
        performanceMetrics.parsingAccuracy <
        this.alertThresholds.parsingAccuracy.critical * 100
      ) {
        alerts.push({
          severity: 'critical' as const,
          component: 'document_processing',
          message: `Document parsing accuracy is critically low at ${performanceMetrics.parsingAccuracy}%`,
          timestamp: now,
          actionRequired: true,
        });
      }

      // System health alerts
      if (systemHealth.overall < this.alertThresholds.systemHealth.critical) {
        alerts.push({
          severity: 'critical' as const,
          component: 'system',
          message: `Overall system health is critically low at ${systemHealth.overall}%`,
          timestamp: now,
          actionRequired: true,
        });
      }

      // Check for learning stagnation
      const learningMetrics = await this.calculateLearningMetrics(
        startDate,
        endDate
      );
      if (
        learningMetrics.learningRate < this.alertThresholds.learningRate.warning
      ) {
        alerts.push({
          severity: 'warning' as const,
          component: 'learning_system',
          message: `Learning rate is low at ${learningMetrics.learningRate} events/day`,
          timestamp: now,
          actionRequired: false,
        });
      }

      return alerts;
    } catch (error) {
      console.error('Error generating alerts:', error);
      alerts.push({
        severity: 'warning' as const,
        component: 'monitoring',
        message: 'Error occurred while generating alerts',
        timestamp: now,
        actionRequired: false,
      });
      return alerts;
    }
  }

  /**
   * Analyze metric trends over time
   */
  async analyzeMetricTrends(
    metricName: string,
    timeframes: string[] = ['24h', '7d', '30d']
  ): Promise<MetricTrend[]> {
    const trends: MetricTrend[] = [];

    for (const timeframe of timeframes) {
      try {
        const currentPeriod =
          await this.generatePerformanceDashboard(timeframe);

        // Get comparison period (previous equivalent timeframe)
        const previousTimeframe = this.getPreviousTimeframe(timeframe);
        const previousPeriod =
          await this.generatePerformanceDashboard(previousTimeframe);

        const currentValue = this.extractMetricValue(currentPeriod, metricName);
        const previousValue = this.extractMetricValue(
          previousPeriod,
          metricName
        );

        const changePercent =
          previousValue > 0
            ? ((currentValue - previousValue) / previousValue) * 100
            : 0;

        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (Math.abs(changePercent) > 5) {
          trend = changePercent > 0 ? 'improving' : 'declining';
        }

        const significance =
          Math.abs(changePercent) > 20
            ? 'high'
            : Math.abs(changePercent) > 10
              ? 'medium'
              : 'low';

        trends.push({
          metricName,
          timeframe: timeframe as any,
          currentValue,
          previousValue,
          changePercent: Number(changePercent.toFixed(2)),
          trend,
          significance,
          context: {
            period: timeframe,
            comparison: previousTimeframe,
          },
        });
      } catch (error) {
        console.error(
          `Error analyzing trend for ${metricName} over ${timeframe}:`,
          error
        );
      }
    }

    return trends;
  }

  /**
   * Create comprehensive improvement plan
   */
  async createImprovementPlan(
    focusAreas: string[] = []
  ): Promise<ImprovementPlan> {
    try {
      const dashboard = await this.generatePerformanceDashboard('30d');
      const opportunities = dashboard.improvementOpportunities;

      // Filter opportunities by focus areas if specified
      const filteredOpportunities =
        focusAreas.length > 0
          ? opportunities.filter(opp => focusAreas.includes(opp.component))
          : opportunities;

      // Prioritize actions based on impact and effort
      const actions = filteredOpportunities
        .sort((a, b) => {
          const impactWeight = { high: 3, medium: 2, low: 1 };
          const effortWeight = { low: 3, medium: 2, high: 1 }; // Inverse - low effort is better

          const scoreA = impactWeight[a.impact] * effortWeight[a.effort];
          const scoreB = impactWeight[b.impact] * effortWeight[b.effort];

          return scoreB - scoreA;
        })
        .slice(0, 8)
        .map((opp, index) => ({
          actionId: `action_${Date.now()}_${index}`,
          description: opp.recommendation,
          priority: opp.impact,
          estimatedImpact: this.calculateEstimatedImpact(opp),
          status: 'planned' as const,
          assignedComponent: opp.component,
        }));

      // Create target metrics based on current performance and improvement targets
      const targetMetrics = [
        {
          metricName: 'proposalWinRate',
          currentValue: dashboard.performanceMetrics.proposalWinRate,
          targetValue: Math.min(
            dashboard.performanceMetrics.proposalWinRate * 1.5,
            this.improvementTargets.proposalWinRate * 100
          ),
          timeframe: '90 days',
        },
        {
          metricName: 'parsingAccuracy',
          currentValue: dashboard.performanceMetrics.parsingAccuracy,
          targetValue: Math.min(
            dashboard.performanceMetrics.parsingAccuracy * 1.1,
            this.improvementTargets.parsingAccuracy * 100
          ),
          timeframe: '60 days',
        },
        {
          metricName: 'systemHealth',
          currentValue: dashboard.systemHealth.overall,
          targetValue: Math.min(dashboard.systemHealth.overall * 1.2, 95),
          timeframe: '30 days',
        },
      ];

      const planId = `improvement_plan_${Date.now()}`;
      const startDate = new Date();
      const targetDate = new Date(
        startDate.getTime() + 90 * 24 * 60 * 60 * 1000
      ); // 90 days

      const plan: ImprovementPlan = {
        planId,
        title: 'Continuous Improvement Plan',
        description:
          'Comprehensive plan to enhance system performance and learning capabilities',
        targetMetrics,
        actions,
        timeline: {
          startDate: startDate.toISOString(),
          targetDate: targetDate.toISOString(),
          milestones: this.generateMilestones(
            startDate,
            targetDate,
            actions.length
          ),
        },
        riskAssessment: {
          risks: [
            {
              description: 'Changes may temporarily disrupt system performance',
              probability: 'medium' as const,
              impact: 'medium' as const,
              mitigation:
                'Implement changes gradually with rollback capabilities',
            },
            {
              description:
                'Resource constraints may limit implementation speed',
              probability: 'low' as const,
              impact: 'low' as const,
              mitigation:
                'Prioritize high-impact, low-effort improvements first',
            },
          ],
          overallRisk: 'low' as const,
        },
      };

      // Store improvement plan
      await this.storeImprovementPlan(plan);

      return plan;
    } catch (error) {
      console.error('Error creating improvement plan:', error);
      throw error;
    }
  }

  /**
   * Monitor improvement plan progress
   */
  async monitorImprovementProgress(planId: string): Promise<{
    plan: ImprovementPlan;
    progress: {
      overallProgress: number;
      completedActions: number;
      onTrackMetrics: number;
      risksRealized: number;
    };
    recommendations: string[];
  }> {
    try {
      const plan = await this.getImprovementPlan(planId);
      if (!plan) {
        throw new Error(`Improvement plan ${planId} not found`);
      }

      // Calculate progress metrics
      const completedActions = plan.actions.filter(
        action => action.status === 'completed'
      ).length;
      const overallProgress = (completedActions / plan.actions.length) * 100;

      // Check metric progress
      const currentDashboard = await this.generatePerformanceDashboard('7d');
      let onTrackMetrics = 0;

      for (const metric of plan.targetMetrics) {
        const currentValue = this.extractMetricValue(
          currentDashboard,
          metric.metricName
        );

        // Guard against divide-by-zero when targetValue equals currentValue
        const denominator = metric.targetValue - metric.currentValue;
        if (denominator === 0) {
          // Target already met, count as on-track
          onTrackMetrics++;
          continue;
        }

        const progress = (currentValue - metric.currentValue) / denominator;

        // Ensure progress is finite before comparing
        if (Number.isFinite(progress) && progress >= 0.1) {
          // At least 10% progress
          onTrackMetrics++;
        }
      }

      // Generate recommendations
      const recommendations = [];
      if (overallProgress < 30) {
        recommendations.push(
          'Consider accelerating high-priority actions to maintain timeline'
        );
      }
      if (onTrackMetrics < plan.targetMetrics.length * 0.6) {
        recommendations.push(
          'Review and adjust target metrics or implementation strategies'
        );
      }

      return {
        plan,
        progress: {
          overallProgress: Number(overallProgress.toFixed(1)),
          completedActions,
          onTrackMetrics,
          risksRealized: 0, // This would be calculated based on actual risk tracking
        },
        recommendations,
      };
    } catch (error) {
      console.error('Error monitoring improvement progress:', error);
      throw error;
    }
  }

  // Helper methods
  private getPreviousTimeframe(timeframe: string): string {
    const multipliers: Record<string, string> = {
      '1h': '2h',
      '24h': '48h',
      '7d': '14d',
      '30d': '60d',
    };
    return multipliers[timeframe] || '14d';
  }

  private extractMetricValue(
    dashboard: PerformanceDashboard,
    metricName: string
  ): number {
    const metricPaths: Record<string, any> = {
      proposalWinRate: dashboard.performanceMetrics.proposalWinRate,
      parsingAccuracy: dashboard.performanceMetrics.parsingAccuracy,
      portalNavigationSuccess:
        dashboard.performanceMetrics.portalNavigationSuccess,
      systemHealth: dashboard.systemHealth.overall,
      learningRate: dashboard.learningMetrics.learningRate,
    };
    return metricPaths[metricName] || 0;
  }

  private calculateEstimatedImpact(opportunity: any): number {
    const impactScores = { high: 0.8, medium: 0.5, low: 0.2 };
    return impactScores[opportunity.impact as keyof typeof impactScores] || 0.3;
  }

  private generateMilestones(
    startDate: Date,
    endDate: Date,
    actionCount: number
  ): Array<{
    date: string;
    description: string;
    completed: boolean;
  }> {
    const milestones = [];
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const milestoneInterval = Math.floor(totalDays / 4); // 4 milestones

    for (let i = 1; i <= 4; i++) {
      const milestoneDate = new Date(
        startDate.getTime() + i * milestoneInterval * 24 * 60 * 60 * 1000
      );
      milestones.push({
        date: milestoneDate.toISOString(),
        description: `Complete ${Math.ceil(
          (actionCount * i) / 4
        )} improvement actions`,
        completed: false,
      });
    }

    return milestones;
  }

  private async storeDashboardSnapshot(
    dashboard: PerformanceDashboard
  ): Promise<void> {
    try {
      await db.insert(agentMemory).values({
        id: `dashboard_${randomUUID()}`,
        agentId: 'continuous_improvement_monitor',
        memoryType: 'semantic',
        contextKey: 'dashboard_snapshot',
        title: 'Performance Dashboard Snapshot',
        content: dashboard,
        metadata: {
          type: 'dashboard_snapshot',
          timestamp: dashboard.timestamp,
        },
        importance: 8,
        createdAt: new Date(),
      });
    } catch (error: any) {
      // Silently ignore duplicate key errors (code 23505) - dashboard snapshots are non-critical
      if (error?.code !== '23505') {
        console.error('Error storing dashboard snapshot:', error);
      }
    }
  }

  private async storeImprovementPlan(plan: ImprovementPlan): Promise<void> {
    try {
      await db.insert(agentMemory).values({
        id: plan.planId,
        agentId: 'continuous_improvement_monitor',
        memoryType: 'procedural',
        contextKey: 'improvement_plan',
        title: 'Improvement Plan',
        content: plan,
        metadata: {
          type: 'improvement_plan',
          planId: plan.planId,
          status: 'active',
        },
        importance: 9,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error storing improvement plan:', error);
    }
  }

  private async getImprovementPlan(
    planId: string
  ): Promise<ImprovementPlan | null> {
    try {
      const result = await db
        .select()
        .from(agentMemory)
        .where(eq(agentMemory.id, planId))
        .limit(1);

      if (result.length === 0) return null;

      const rawContent = result[0].content;
      if (typeof rawContent === 'string') {
        return JSON.parse(rawContent) as ImprovementPlan;
      }
      return rawContent as ImprovementPlan;
    } catch (error) {
      console.error('Error retrieving improvement plan:', error);
      return null;
    }
  }
}

export const continuousImprovementMonitor = new ContinuousImprovementMonitor();

export type { ImprovementPlan, MetricTrend, PerformanceDashboard };
