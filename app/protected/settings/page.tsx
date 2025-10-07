"use client";

import { RobotToggle } from "@/components/settings/robot-toggle";
import { IntegrationsSection } from "@/components/settings/integrations-section";

const Settings = () => {
    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl">
            <div className="space-y-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">
                        Manage your application preferences and settings
                    </p>
                </div>
                
                <div className="grid gap-6">
                    <IntegrationsSection />
                    <RobotToggle />
                </div>
            </div>
        </div>
    );
};

export default Settings;