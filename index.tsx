import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Users, GraduationCap, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const scenarios = [
  {
    id: 1,
    category: "workplace",
    title: "Team Meeting Introduction",
    description: "Practice introducing yourself to a new team with confidence and professionalism",
    icon: Briefcase,
    difficulty: "easy",
    duration: "5-10 min",
  },
  {
    id: 2,
    category: "workplace",
    title: "Performance Review Discussion",
    description: "Navigate a professional conversation about your work performance",
    icon: Briefcase,
    difficulty: "medium",
    duration: "10-15 min",
  },
  {
    id: 3,
    category: "social",
    title: "Casual Group Conversation",
    description: "Join and contribute to a casual conversation among friends",
    icon: Users,
    difficulty: "easy",
    duration: "5-10 min",
  },
  {
    id: 4,
    category: "social",
    title: "Networking Event",
    description: "Make meaningful connections at a professional networking event",
    icon: Users,
    difficulty: "medium",
    duration: "10-15 min",
  },
  {
    id: 5,
    category: "educational",
    title: "Classroom Presentation",
    description: "Present your ideas clearly to classmates and answer questions",
    icon: GraduationCap,
    difficulty: "medium",
    duration: "10-15 min",
  },
  {
    id: 6,
    category: "educational",
    title: "Study Group Discussion",
    description: "Collaborate effectively with peers in a study session",
    icon: GraduationCap,
    difficulty: "easy",
    duration: "5-10 min",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");

  const filteredScenarios = scenarios.filter((scenario) => {
    const categoryMatch =
      selectedCategory === "all" || scenario.category === selectedCategory;
    const difficultyMatch =
      selectedDifficulty === "all" || scenario.difficulty === selectedDifficulty;
    return categoryMatch && difficultyMatch;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-primary/10 text-primary border-primary/20";
      case "medium":
        return "bg-accent/10 text-accent border-accent/20";
      case "hard":
        return "bg-destructive/10 text-destructive border-destructive/20";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="bg-gradient-hero text-primary-foreground py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 animate-fade-in">
            Practice Social Conversations
          </h1>
          <p className="text-lg md:text-xl opacity-95 mb-8 animate-fade-in">
            Build confidence through realistic AI-powered conversations with natural social cues
          </p>
          <div className="flex flex-wrap gap-4 justify-center animate-fade-in">
            <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <Briefcase className="w-4 h-4" />
              <span className="text-sm">Workplace</span>
            </div>
            <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <Users className="w-4 h-4" />
              <span className="text-sm">Social</span>
            </div>
            <div className="flex items-center gap-2 bg-primary-foreground/10 backdrop-blur-sm px-4 py-2 rounded-full">
              <GraduationCap className="w-4 h-4" />
              <span className="text-sm">Educational</span>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-4 justify-center">
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="workplace">Workplace</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="educational">Educational</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedDifficulty} onValueChange={setSelectedDifficulty}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Scenarios Grid */}
      <section className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario, index) => {
            const Icon = scenario.icon;
            return (
              <Card
                key={scenario.id}
                className="p-6 hover:shadow-soft transition-all duration-300 cursor-pointer group bg-gradient-card border-border animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>
                  <Badge className={getDifficultyColor(scenario.difficulty)}>
                    {scenario.difficulty}
                  </Badge>
                </div>

                <h3 className="text-lg font-semibold mb-2 text-foreground group-hover:text-primary transition-colors">
                  {scenario.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {scenario.description}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    {scenario.duration}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => navigate("/practice")}
                    className="gap-2 group-hover:shadow-soft"
                  >
                    <Play className="w-4 h-4" />
                    Start
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Index;
