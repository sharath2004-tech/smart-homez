import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Star, TrendingDown, TrendingUp, Minus, Calendar, BarChart3 } from "lucide-react";

interface RatingTrend {
  currentPeriod: {
    averageRating: number;
    reviewCount: number;
    averageQuality: number;
    averageTimeliness: number;
    averageProfessionalism: number;
  };
  previousPeriod: {
    averageRating: number;
    reviewCount: number;
  };
  changes: {
    rating: number;
    reviews: number;
    percentage: number;
  };
  trend: 'improving' | 'declining' | 'stable';
}

interface WeeklyData {
  week: string;
  averageRating: number;
  categoryAverages: {
    quality: number;
    timeliness: number;
    professionalism: number;
  };
  reviewCount: number;
}

interface MonthlyData {
  month: string;
  averageRating: number;
  categoryAverages: {
    quality: number;
    timeliness: number;
    professionalism: number;
  };
  reviewCount: number;
  satisfactionRate: number;
}

interface WorkerRatingAnalyticsProps {
  workerId: string;
  workerName: string;
  currentRating: number;
  totalReviews: number;
  trends?: RatingTrend;
  weeklyData?: WeeklyData[];
  monthlyData?: MonthlyData[];
  className?: string;
}

export function WorkerRatingAnalytics({
  workerId,
  workerName,
  currentRating,
  totalReviews,
  trends,
  weeklyData,
  monthlyData,
  className = ""
}: WorkerRatingAnalyticsProps) {
  // Get rating color based on value
  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-600";
    if (rating >= 3.5) return "text-amber-600";
    return "text-red-600";
  };

  // Get trend indicator
  const getTrendIndicator = (trend: string, change: number) => {
    switch (trend) {
      case 'improving':
        return {
          icon: <TrendingUp className="w-4 h-4 text-green-600" />,
          text: `+${change.toFixed(1)}`,
          color: "text-green-600"
        };
      case 'declining':
        return {
          icon: <TrendingDown className="w-4 h-4 text-red-600" />,
          text: `${change.toFixed(1)}`,
          color: "text-red-600"
        };
      default:
        return {
          icon: <Minus className="w-4 h-4 text-gray-500" />,
          text: "Stable",
          color: "text-gray-500"
        };
    }
  };

  const trendIndicator = trends ? getTrendIndicator(trends.trend, trends.changes.rating) : null;

  // Get latest weekly and monthly averages
  const latestWeek = weeklyData?.[weeklyData.length - 1];
  const latestMonth = monthlyData?.[monthlyData.length - 1];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Rating Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
              <span className={`text-2xl font-bold ${getRatingColor(currentRating)}`}>
                {currentRating.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/ 5.0</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {totalReviews} reviews
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Progress value={currentRating * 20} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground">
              {Math.round(currentRating * 20)}%
            </span>
          </div>
        </div>

        {/* Trend Analysis */}
        {trends && trendIndicator && (
          <div className="space-y-3 p-3 bg-muted rounded-lg">
            <h4 className="text-sm font-medium">30-day Trend</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {trendIndicator.icon}
                <span className={`text-sm font-medium ${trendIndicator.color}`}>
                  {trendIndicator.text}
                </span>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">
                  {trends.currentPeriod.averageRating.toFixed(1)}
                </div>
                <div className="text-xs text-muted-foreground">
                  vs {trends.previousPeriod.averageRating.toFixed(1)} prev
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {trends.currentPeriod.reviewCount} reviews this period
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {latestMonth && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-sm font-medium">Category Ratings (This Month)</h4>
            </div>

            <div className="space-y-2">
              {/* Quality */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Quality</span>
                <div className="flex items-center gap-2">
                  <Progress
                    value={latestMonth.categoryAverages.quality * 20}
                    className="w-16 h-1.5"
                  />
                  <span className="text-xs font-medium w-8 text-right">
                    {latestMonth.categoryAverages.quality.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Timeliness */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Timeliness</span>
                <div className="flex items-center gap-2">
                  <Progress
                    value={latestMonth.categoryAverages.timeliness * 20}
                    className="w-16 h-1.5"
                  />
                  <span className="text-xs font-medium w-8 text-right">
                    {latestMonth.categoryAverages.timeliness.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Professionalism */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Professionalism</span>
                <div className="flex items-center gap-2">
                  <Progress
                    value={latestMonth.categoryAverages.professionalism * 20}
                    className="w-16 h-1.5"
                  />
                  <span className="text-xs font-medium w-8 text-right">
                    {latestMonth.categoryAverages.professionalism.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            {/* Satisfaction Rate */}
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm font-medium">Customer Satisfaction</span>
              <Badge variant="outline" className={
                latestMonth.satisfactionRate >= 80 ? "border-green-200 text-green-700" :
                latestMonth.satisfactionRate >= 60 ? "border-amber-200 text-amber-700" :
                "border-red-200 text-red-700"
              }>
                {latestMonth.satisfactionRate}%
              </Badge>
            </div>
          </div>
        )}

        {/* Weekly Summary */}
        {weeklyData && weeklyData.length > 0 && (
          <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900">Recent Weeks</h4>
            <div className="space-y-2">
              {weeklyData.slice(-3).map((week, index) => (
                <div key={week.week} className="flex items-center justify-between">
                  <span className="text-xs text-blue-800">
                    Week {index + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                    <span className="text-xs font-medium text-blue-900">
                      {week.averageRating.toFixed(1)}
                    </span>
                    <span className="text-xs text-blue-700">
                      ({week.reviewCount})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Insights */}
        <div className="space-y-2 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900">Quick Insights</h4>
          <ul className="text-xs text-gray-700 space-y-1">
            {currentRating >= 4.5 && (
              <li>• Excellent performance - top 10% of workers</li>
            )}
            {trends?.trend === 'improving' && (
              <li>• Showing consistent improvement this month</li>
            )}
            {latestMonth?.satisfactionRate && latestMonth.satisfactionRate >= 80 && (
              <li>• High customer satisfaction rate</li>
            )}
            {totalReviews < 5 && (
              <li>• Limited review data - encourage more customer feedback</li>
            )}
            {trends?.currentPeriod.reviewCount === 0 && (
              <li>• No recent reviews - check booking activity</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}