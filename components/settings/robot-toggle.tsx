"use client";

import React from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRobotSettings } from "@/hooks/use-robot-settings";
import { BotIcon } from "lucide-react";

interface RobotToggleProps {
  onToggle?: (enabled: boolean) => void;
  className?: string;
}

export const RobotToggle: React.FC<RobotToggleProps> = ({ onToggle, className }) => {
  const { isRobotEnabled, isLoading, setRobotEnabled } = useRobotSettings();

  const handleToggle = (checked: boolean) => {
    setRobotEnabled(checked);
    onToggle?.(checked);
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <BotIcon className="h-5 w-5" />
            Robot Background
          </CardTitle>
          <CardDescription>
            Loading settings...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BotIcon className="h-5 w-5" />
          Robot Background
        </CardTitle>
        <CardDescription>
          Toggle the 3D robot background in the chat interface
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Switch
            id="robot-toggle"
            checked={isRobotEnabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
          <Label htmlFor="robot-toggle" className="text-sm font-medium">
            {isRobotEnabled ? "Enabled" : "Disabled"}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isRobotEnabled 
            ? "The 3D robot background will be visible in the chat interface"
            : "The chat interface will have a clean background without the robot"
          }
        </p>
      </CardContent>
    </Card>
  );
};
