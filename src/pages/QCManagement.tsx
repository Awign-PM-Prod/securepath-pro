import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import QCWorkbench from '@/components/QC/QCWorkbench';

export default function QCManagement() {
  return (
    <div className="container mx-auto py-6">
      <Tabs defaultValue="workbench" className="space-y-6">
        <TabsList>
          <TabsTrigger value="workbench">QC Workbench</TabsTrigger>
          <TabsTrigger value="reports">QC Reports</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="workbench">
          <QCWorkbench />
        </TabsContent>

        <TabsContent value="reports">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">QC Reports</h3>
            <p className="text-muted-foreground">QC reporting features coming soon...</p>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">QC Settings</h3>
            <p className="text-muted-foreground">QC configuration features coming soon...</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

