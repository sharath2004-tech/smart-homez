import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle, Clock, TrendingDown, TrendingUp } from "lucide-react";

interface ReliabilityScoreData {
  currentMonthScore?: {
    month?: number;
    year?: number;
    scoreBreakdown: {
      finalScore: number;
      baseScore: number;
      leaveBonus: number;
      leavePenalties: number;
    };
    leaveData: {
      totalLeaves: number;
      uninformedLeaves: number;
      informedLeaves: number;
    };
  };
  currentMonthLabel?: string | null;
  hasCurrentMonthScore?: boolean;
  history?: Array<{
    month: number;
    year: number;
    scoreBreakdown: {
      finalScore: number;
    };
  }>;
}

interface ReliabilityScoreCardProps {
  workerId: string;
  workerName: string;
  currentScore: number; // 0-100 scale from worker profile
  data?: ReliabilityScoreData;
  className?: string;
}

export function ReliabilityScoreCard({
  workerId,
  workerName,
  currentScore,
  data,
  className = ""
}: ReliabilityScoreCardProps) {
  // Get color based on score (0-100 scale)
  const getScoreColor = (score: number) => {
    if (score >= 80) return { color: "text-green-600", bg: "bg-green-50", border: "border-green-200" };
    if (score >= 60) return { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
    return { color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
  };

  // Get score category
  const getScoreCategory = (score: number) => {
    if (score >= 80) return { label: "Excellent", icon: CheckCircle };
    if (score >= 60) return { label: "Good", icon: Clock };
    return { label: "Needs Improvement", icon: AlertTriangle };
  };

  // Calculate trend if history exists
  const getTrend = () => {
    if (!data?.history || data.history.length < 2) return null;

    const recent = data.history.slice(-2);
    const change = recent[1].scoreBreakdown.finalScore - recent[0].scoreBreakdown.finalScore;

    if (Math.abs(change) < 0.5) return { type: 'stable', change: 0 };
    return {
      type: change > 0 ? 'improving' : 'declining',
      change: Math.round(change * 10) / 10
    };
  };

  const scoreStyle = getScoreColor(currentScore);
  const category = getScoreCategory(currentScore);
  const trend = getTrend();
  const IconComponent = category.icon;

  // Convert 0-100 scale to 0-20 for display
  const reliabilityOutOf20 = Math.round((currentScore / 100) * 20 * 10) / 10;

  return (
    <Card className={`${scoreStyle.border} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Reliability Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconComponent className={`w-5 h-5 ${scoreStyle.color}`} />
            <span className={`text-2xl font-bold ${scoreStyle.color}`}>
              {reliabilityOutOf20}/20
            </span>
          </div>
          <Badge variant="outline" className={`${scoreStyle.color} ${scoreStyle.border}`}>
            {category.label}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={currentScore} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0</span>
            <span className="font-medium">{currentScore}%</span>
            <span>100</span>
          </div>
        </div>

        {/* Trend Indicator */}
        {trend && (
          <div className="flex items-center gap-2">
            {trend.type === 'improving' && (
              <>
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">
                  +{trend.change} improving
                </span>
              </>
            )}
            {trend.type === 'declining' && (
              <>
                <TrendingDown className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">
                  {trend.change} declining
                </span>
              </>
            )}
            {trend.type === 'stable' && (
              <>
                <Clock className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-600">Stable</span>
              </>
            )}
          </div>
        )}

        {/* Latest Score Details */}
        {data?.currentMonthScore && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-2">
              {data.hasCurrentMonthScore ? 'This Month Breakdown' : `Latest Score Breakdown${data.currentMonthLabel ? ` (${data.currentMonthLabel})` : ''}`}
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Base Score:</span>
                <span className="font-semibold ml-1">
                  {data.currentMonthScore.scoreBreakdown.baseScore}/20
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Leave Bonus:</span>
                <span className="font-semibold ml-1 text-green-600">
                  +{data.currentMonthScore.scoreBreakdown.leaveBonus}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Penalties:</span>
                <span className="font-semibold ml-1 text-red-600">
                  -{data.currentMonthScore.scoreBreakdown.leavePenalties}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Final Score:</span>
                <span className="font-semibold ml-1">
                  {data.currentMonthScore.scoreBreakdown.finalScore}/20
                </span>
              </div>
            </div>

            <div className="border-t pt-2 mt-2">
              <div className="text-xs text-muted-foreground">
                <span>Leaves: {data.currentMonthScore.leaveData.totalLeaves}</span>
                {data.currentMonthScore.leaveData.uninformedLeaves > 0 && (
                  <span className="ml-2 text-red-600">
                    ({data.currentMonthScore.leaveData.uninformedLeaves} uninformed)
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scoring Rules */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <h4 className="text-xs font-medium text-blue-900 mb-2">Scoring Rules</h4>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Base: 15 points</li>
            <li>• +2 if ≤4 leaves per month</li>
            <li>• -1 per uninformed leave (&lt;24hrs)</li>
            <li>• Max: 20 points</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}