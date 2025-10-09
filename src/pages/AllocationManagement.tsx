import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AllocationDashboard from '@/components/Allocation/AllocationDashboard';
import AllocationConfig from '@/components/Allocation/AllocationConfig';

export default function AllocationManagement() {
  return (
    <div className="container mx-auto py-6">
      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <AllocationDashboard />
        </TabsContent>

        <TabsContent value="config">
          <AllocationConfig />
        </TabsContent>
      </Tabs>
    </div>
  );
}

