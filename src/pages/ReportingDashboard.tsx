import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Users, 
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Download,
  Calendar,
  MapPin,
  Target
} from 'lucide-react';

interface KPIData {
  totalCases: number;
  completedCases: number;
  pendingCases: number;
  overdueCases: number;
  averageTAT: number;
  qualityScore: number;
  totalRevenue: number;
  activeGigWorkers: number;
  clientSatisfaction: number;
  allocationSuccessRate: number;
}

interface CapacityHeatmapData {
  pincode: string;
  city: string;
  state: string;
  availableCapacity: number;
  totalCapacity: number;
  utilizationRate: number;
  casesCompleted: number;
}

interface TATData {
  period: string;
  averageTAT: number;
  targetTAT: number;
  casesCompleted: number;
  onTimeRate: number;
}

interface ClientReportData {
  clientId: string;
  clientName: string;
  totalCases: number;
  completedCases: number;
  averageTAT: number;
  qualityScore: number;
  totalSpent: number;
  satisfactionScore: number;
}

export default function ReportingDashboard() {
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [capacityData, setCapacityData] = useState<CapacityHeatmapData[]>([]);
  const [tatData, setTatData] = useState<TATData[]>([]);
  const [clientData, setClientData] = useState<ClientReportData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('all');

  // Mock data - in real app, this would come from API
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // Simulate API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setKpiData({
        totalCases: 1247,
        completedCases: 1156,
        pendingCases: 67,
        overdueCases: 24,
        averageTAT: 18.5,
        qualityScore: 92.3,
        totalRevenue: 2847500,
        activeGigWorkers: 156,
        clientSatisfaction: 4.7,
        allocationSuccessRate: 89.2,
      });

      setCapacityData([
        { pincode: '400001', city: 'Mumbai', state: 'Maharashtra', availableCapacity: 8, totalCapacity: 12, utilizationRate: 33.3, casesCompleted: 45 },
        { pincode: '110001', city: 'New Delhi', state: 'Delhi', availableCapacity: 5, totalCapacity: 10, utilizationRate: 50.0, casesCompleted: 38 },
        { pincode: '560001', city: 'Bangalore', state: 'Karnataka', availableCapacity: 12, totalCapacity: 15, utilizationRate: 20.0, casesCompleted: 52 },
        { pincode: '600001', city: 'Chennai', state: 'Tamil Nadu', availableCapacity: 3, totalCapacity: 8, utilizationRate: 62.5, casesCompleted: 29 },
        { pincode: '700001', city: 'Kolkata', state: 'West Bengal', availableCapacity: 7, totalCapacity: 9, utilizationRate: 22.2, casesCompleted: 31 },
      ]);

      setTatData([
        { period: 'Week 1', averageTAT: 16.2, targetTAT: 24, casesCompleted: 145, onTimeRate: 94.5 },
        { period: 'Week 2', averageTAT: 18.7, targetTAT: 24, casesCompleted: 167, onTimeRate: 91.6 },
        { period: 'Week 3', averageTAT: 19.3, targetTAT: 24, casesCompleted: 189, onTimeRate: 89.4 },
        { period: 'Week 4', averageTAT: 17.8, targetTAT: 24, casesCompleted: 203, onTimeRate: 92.1 },
      ]);

      setClientData([
        { clientId: '1', clientName: 'ABC Corporation', totalCases: 234, completedCases: 221, averageTAT: 16.8, qualityScore: 94.2, totalSpent: 125000, satisfactionScore: 4.8 },
        { clientId: '2', clientName: 'XYZ Industries', totalCases: 189, completedCases: 178, averageTAT: 19.2, qualityScore: 91.5, totalSpent: 98000, satisfactionScore: 4.6 },
        { clientId: '3', clientName: 'Tech Solutions Ltd', totalCases: 156, completedCases: 149, averageTAT: 17.5, qualityScore: 93.1, totalSpent: 87000, satisfactionScore: 4.7 },
        { clientId: '4', clientName: 'Global Enterprises', totalCases: 98, completedCases: 92, averageTAT: 20.1, qualityScore: 89.8, totalSpent: 56000, satisfactionScore: 4.4 },
      ]);

      setIsLoading(false);
    };

    loadData();
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 80) return 'text-red-600';
    if (rate >= 60) return 'text-orange-600';
    if (rate >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getTATColor = (tat: number, target: number) => {
    const ratio = tat / target;
    if (ratio <= 0.75) return 'text-green-600';
    if (ratio <= 1.0) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reporting Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive analytics and performance insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpiData && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.totalCases.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {kpiData.completedCases} completed ({((kpiData.completedCases / kpiData.totalCases) * 100).toFixed(1)}%)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average TAT</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.averageTAT}h</div>
              <p className="text-xs text-muted-foreground">
                Target: 24h
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality Score</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpiData.qualityScore}%</div>
              <p className="text-xs text-muted-foreground">
                Target: 90%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpiData.totalRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                {kpiData.activeGigWorkers} active workers
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Heatmap</TabsTrigger>
          <TabsTrigger value="tat">TAT Monitoring</TabsTrigger>
          <TabsTrigger value="clients">Client Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Case Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Case Status Distribution</CardTitle>
                <CardDescription>Current status of all cases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kpiData?.completedCases}</span>
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div 
                          className="h-2 bg-green-600 rounded-full"
                          style={{ width: `${((kpiData?.completedCases || 0) / (kpiData?.totalCases || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm">Pending</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kpiData?.pendingCases}</span>
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div 
                          className="h-2 bg-yellow-600 rounded-full"
                          style={{ width: `${((kpiData?.pendingCases || 0) / (kpiData?.totalCases || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm">Overdue</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kpiData?.overdueCases}</span>
                      <div className="w-24 h-2 bg-muted rounded-full">
                        <div 
                          className="h-2 bg-red-600 rounded-full"
                          style={{ width: `${((kpiData?.overdueCases || 0) / (kpiData?.totalCases || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Metrics</CardTitle>
                <CardDescription>Key performance indicators</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Allocation Success Rate</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kpiData?.allocationSuccessRate}%</span>
                      <Progress value={kpiData?.allocationSuccessRate || 0} className="w-20" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Client Satisfaction</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kpiData?.clientSatisfaction}/5</span>
                      <Progress value={(kpiData?.clientSatisfaction || 0) * 20} className="w-20" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Quality Score</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kpiData?.qualityScore}%</span>
                      <Progress value={kpiData?.qualityScore || 0} className="w-20" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Capacity Heatmap Tab */}
        <TabsContent value="capacity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Capacity Heatmap
              </CardTitle>
              <CardDescription>
                Gig worker capacity utilization by location
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {capacityData.map((location) => (
                  <div key={location.pincode} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-medium">{location.city}, {location.state}</h3>
                        <p className="text-sm text-muted-foreground">Pincode: {location.pincode}</p>
                      </div>
                      <Badge variant="outline">
                        {location.casesCompleted} cases
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Capacity Utilization</span>
                        <span className={`font-medium ${getUtilizationColor(location.utilizationRate)}`}>
                          {location.utilizationRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={location.utilizationRate} className="h-2" />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Available:</span>
                          <span className="ml-2 font-medium">{location.availableCapacity}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>
                          <span className="ml-2 font-medium">{location.totalCapacity}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAT Monitoring Tab */}
        <TabsContent value="tat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                TAT Monitoring
              </CardTitle>
              <CardDescription>
                Turnaround time performance over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tatData.map((period) => (
                  <div key={period.period} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{period.period}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {period.casesCompleted} cases
                        </Badge>
                        <Badge variant={period.onTimeRate >= 90 ? "default" : "destructive"}>
                          {period.onTimeRate.toFixed(1)}% on-time
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Average TAT</span>
                        <span className={`font-medium ${getTATColor(period.averageTAT, period.targetTAT)}`}>
                          {period.averageTAT}h
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Target TAT</span>
                        <span className="text-muted-foreground">{period.targetTAT}h</span>
                      </div>
                      <Progress 
                        value={(period.averageTAT / period.targetTAT) * 100} 
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Reports Tab */}
        <TabsContent value="clients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Client Performance Reports
              </CardTitle>
              <CardDescription>
                Performance metrics by client
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clientData.map((client) => (
                  <div key={client.clientId} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium">{client.clientName}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {client.completedCases}/{client.totalCases} cases
                        </Badge>
                        <Badge variant={client.satisfactionScore >= 4.5 ? "default" : "secondary"}>
                          {client.satisfactionScore}/5 satisfaction
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Avg TAT:</span>
                        <span className="ml-2 font-medium">{client.averageTAT}h</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quality:</span>
                        <span className="ml-2 font-medium">{client.qualityScore}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Spent:</span>
                        <span className="ml-2 font-medium">{formatCurrency(client.totalSpent)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Completion:</span>
                        <span className="ml-2 font-medium">
                          {((client.completedCases / client.totalCases) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

