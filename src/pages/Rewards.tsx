import Header from "@/components/Header";
import BottomNavigation from "@/components/BottomNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Gift, Star, Trophy, Coins, Calendar, CheckCircle } from "lucide-react";

const Rewards = () => {
  const userStats = {
    totalPoints: 2450,
    currentLevel: "Gold",
    nextLevel: "Platinum",
    pointsToNextLevel: 550,
    applicationsThisMonth: 8,
    referrals: 3
  };

  const availableRewards = [
    {
      id: 1,
      title: "Amazon Gift Card ₹500",
      points: 1000,
      category: "Gift Cards",
      available: true,
      image: "🎁"
    },
    {
      id: 2,
      title: "Premium Profile Boost",
      points: 500,
      category: "Profile",
      available: true,
      image: "⭐"
    },
    {
      id: 3,
      title: "Resume Review Service",
      points: 300,
      category: "Career",
      available: true,
      image: "📄"
    },
    {
      id: 4,
      title: "Flipkart Voucher ₹1000",
      points: 2000,
      category: "Gift Cards",
      available: false,
      image: "🛒"
    },
    {
      id: 5,
      title: "Interview Preparation Course",
      points: 800,
      category: "Career",
      available: true,
      image: "🎯"
    },
    {
      id: 6,
      title: "LinkedIn Premium 1 Month",
      points: 1200,
      category: "Career",
      available: true,
      image: "💼"
    }
  ];

  const rewardHistory = [
    {
      id: 1,
      title: "Resume Review Service",
      points: 300,
      date: "2024-01-10",
      status: "Redeemed"
    },
    {
      id: 2,
      title: "Amazon Gift Card ₹500",
      points: 1000,
      date: "2024-01-05",
      status: "Delivered"
    }
  ];

  const pointsEarningWays = [
    { action: "Complete Profile", points: 100, completed: true },
    { action: "Apply to 5 Jobs", points: 200, completed: true },
    { action: "Refer a Friend", points: 500, completed: false },
    { action: "Get Interview Call", points: 300, completed: true },
    { action: "Update Skills", points: 50, completed: false }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header hideSearch />
      
        <main className="container mx-auto px-4 py-6 pb-20">
          <div className="space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Rewards</h1>
            <p className="text-muted-foreground">Earn points and redeem exciting rewards</p>
          </div>

          {/* Points Overview */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <Coins className="w-6 h-6 text-primary" />
                    <span className="text-2xl font-bold text-foreground">{userStats.totalPoints}</span>
                    <span className="text-sm text-muted-foreground">Points</span>
                  </div>
                  <Badge variant="secondary" className="bg-primary/20 text-primary">
                    {userStats.currentLevel} Member
                  </Badge>
                </div>
                
                <div className="text-center sm:text-right">
                  <p className="text-sm text-muted-foreground mb-2">
                    {userStats.pointsToNextLevel} points to {userStats.nextLevel}
                  </p>
                  <Progress 
                    value={(userStats.totalPoints / (userStats.totalPoints + userStats.pointsToNextLevel)) * 100} 
                    className="w-48"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Earn Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="w-5 h-5 mr-2" />
                Earn More Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pointsEarningWays.map((way, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      {way.completed ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <div className="w-5 h-5 border-2 border-muted-foreground rounded-full" />
                      )}
                      <span className={`text-sm ${way.completed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                        {way.action}
                      </span>
                    </div>
                    <Badge variant={way.completed ? "secondary" : "default"}>
                      +{way.points} pts
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Available Rewards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Gift className="w-5 h-5 mr-2" />
                Available Rewards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableRewards.map((reward) => (
                  <Card key={reward.id} className="relative">
                    <CardContent className="p-4">
                      <div className="text-center space-y-3">
                        <div className="text-3xl">{reward.image}</div>
                        <h3 className="text-sm font-semibold text-foreground">{reward.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {reward.category}
                        </Badge>
                        <div className="flex items-center justify-center space-x-1">
                          <Coins className="w-4 h-4 text-primary" />
                          <span className="text-lg font-bold text-primary">{reward.points}</span>
                        </div>
                        <Button 
                          size="sm" 
                          className="w-full"
                          disabled={!reward.available || userStats.totalPoints < reward.points}
                        >
                          {!reward.available 
                            ? "Coming Soon" 
                            : userStats.totalPoints < reward.points 
                              ? "Insufficient Points" 
                              : "Redeem"
                          }
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Reward History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trophy className="w-5 h-5 mr-2" />
                Reward History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rewardHistory.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{item.title}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.status === "Delivered" ? "default" : "secondary"}>
                        {item.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">-{item.points} pts</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </div>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default Rewards;