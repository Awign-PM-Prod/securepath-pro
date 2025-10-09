import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Target,
  Users
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface AllocationConfig {
  scoring_weights: {
    quality_score: number;
    completion_rate: number;
    ontime_completion_rate: number;
    acceptance_rate: number;
  };
  acceptance_window: {
    minutes: number;
    nudge_after_minutes: number;
    max_waves: number;
  };
  capacity_rules: {
    consume_on: string;
    free_on: string;
    reset_time: string;
    max_daily_capacity: number;
  };
  quality_thresholds: {
    min_quality_score: number;
    min_completion_rate: number;
    min_acceptance_rate: number;
  };
}

const CONSUME_OPTIONS = [
  { value: 'allocated', label: 'On Allocation' },
  { value: 'accepted', label: 'On Acceptance' },
  { value: 'in_progress', label: 'On In Progress' },
];

const FREE_OPTIONS = [
  { value: 'submitted', label: 'On Submission' },
  { value: 'qc_passed', label: 'On QC Pass' },
  { value: 'completed', label: 'On Completion' },
];

export default function AllocationConfig() {
  const [config, setConfig] = useState<AllocationConfig>({
    scoring_weights: {
      quality_score: 0.35,
      completion_rate: 0.25,
      ontime_completion_rate: 0.25,
      acceptance_rate: 0.15,
    },
    acceptance_window: {
      minutes: 30,
      nudge_after_minutes: 15,
      max_waves: 3,
    },
    capacity_rules: {
      consume_on: 'accepted',
      free_on: 'submitted',
      reset_time: '06:00',
      max_daily_capacity: 10,
    },
    quality_thresholds: {
      min_quality_score: 0.85,
      min_completion_rate: 0.80,
      min_acceptance_rate: 0.70,
    },
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('allocation_config')
        .select('config_key, config_value')
        .in('config_key', [
          'scoring_weights',
          'acceptance_window',
          'capacity_rules',
          'quality_thresholds'
        ]);

      if (error) throw error;

      const loadedConfig: Partial<AllocationConfig> = {};
      data?.forEach(item => {
        loadedConfig[item.config_key as keyof AllocationConfig] = item.config_value;
      });

      if (Object.keys(loadedConfig).length > 0) {
        setConfig(prev => ({ ...prev, ...loadedConfig }));
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      toast({
        title: 'Error',
        description: 'Failed to load allocation configuration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (section: keyof AllocationConfig, field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
    setHasChanges(true);
  };

  const handleSliderChange = (section: keyof AllocationConfig, field: string, value: number[]) => {
    const newValue = value[0] / 100; // Convert percentage to decimal
    handleConfigChange(section, field, newValue);
  };

  const validateWeights = () => {
    const weights = config.scoring_weights;
    const total = weights.quality_score + weights.completion_rate + weights.ontime_completion_rate + weights.acceptance_rate;
    return Math.abs(total - 1.0) < 0.01; // Allow small floating point errors
  };

  const normalizeWeights = () => {
    const weights = config.scoring_weights;
    const total = weights.quality_score + weights.completion_rate + weights.ontime_completion_rate + weights.acceptance_rate;
    
    if (total === 0) return;

    setConfig(prev => ({
      ...prev,
      scoring_weights: {
        quality_score: weights.quality_score / total,
        completion_rate: weights.completion_rate / total,
        ontime_completion_rate: weights.ontime_completion_rate / total,
        acceptance_rate: weights.acceptance_rate / total,
      }
    }));
  };

  const saveConfig = async () => {
    if (!validateWeights()) {
      toast({
        title: 'Invalid Configuration',
        description: 'Scoring weights must add up to 100%',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const updates = Object.entries(config).map(([key, value]) => ({
        config_key: key,
        config_value: value,
        updated_by: userId
      }));

      const { error } = await supabase
        .from('allocation_config')
        .upsert(updates, { onConflict: 'config_key' });

      if (error) throw error;

      setHasChanges(false);
      toast({
        title: 'Configuration Saved',
        description: 'Allocation settings have been updated successfully',
      });
    } catch (error) {
      console.error('Failed to save config:', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetConfig = () => {
    loadConfig();
    setHasChanges(false);
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
          <h1 className="text-3xl font-bold">Allocation Configuration</h1>
          <p className="text-muted-foreground">
            Configure how cases are automatically allocated to gig workers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetConfig} disabled={!hasChanges}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={saveConfig} disabled={!hasChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="scoring" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scoring">Scoring Weights</TabsTrigger>
          <TabsTrigger value="acceptance">Acceptance Window</TabsTrigger>
          <TabsTrigger value="capacity">Capacity Rules</TabsTrigger>
          <TabsTrigger value="quality">Quality Thresholds</TabsTrigger>
        </TabsList>

        {/* Scoring Weights Tab */}
        <TabsContent value="scoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Scoring Weights
              </CardTitle>
              <CardDescription>
                Configure how different factors are weighted in the allocation algorithm
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Quality Score</Label>
                  <Badge variant="outline">
                    {(config.scoring_weights.quality_score * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.scoring_weights.quality_score * 100]}
                  onValueChange={(value) => handleSliderChange('scoring_weights', 'quality_score', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  How much weight to give to QC pass rate and quality metrics
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Completion Rate</Label>
                  <Badge variant="outline">
                    {(config.scoring_weights.completion_rate * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.scoring_weights.completion_rate * 100]}
                  onValueChange={(value) => handleSliderChange('scoring_weights', 'completion_rate', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  How much weight to give to case completion rate
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">On-Time Completion Rate</Label>
                  <Badge variant="outline">
                    {(config.scoring_weights.ontime_completion_rate * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.scoring_weights.ontime_completion_rate * 100]}
                  onValueChange={(value) => handleSliderChange('scoring_weights', 'ontime_completion_rate', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  How much weight to give to on-time completion rate
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Acceptance Rate</Label>
                  <Badge variant="outline">
                    {(config.scoring_weights.acceptance_rate * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.scoring_weights.acceptance_rate * 100]}
                  onValueChange={(value) => handleSliderChange('scoring_weights', 'acceptance_rate', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  How much weight to give to case acceptance rate
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Weight</span>
                  <Badge variant={validateWeights() ? "default" : "destructive"}>
                    {((config.scoring_weights.quality_score + config.scoring_weights.completion_rate + 
                       config.scoring_weights.ontime_completion_rate + config.scoring_weights.acceptance_rate) * 100).toFixed(1)}%
                  </Badge>
                </div>
                {!validateWeights() && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>Weights must add up to 100%</span>
                    <Button variant="outline" size="sm" onClick={normalizeWeights}>
                      Normalize
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Acceptance Window Tab */}
        <TabsContent value="acceptance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Acceptance Window
              </CardTitle>
              <CardDescription>
                Configure how long gig workers have to accept allocated cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label htmlFor="acceptance-minutes">Acceptance Window (minutes)</Label>
                <Input
                  id="acceptance-minutes"
                  type="number"
                  min="5"
                  max="120"
                  value={config.acceptance_window.minutes}
                  onChange={(e) => handleConfigChange('acceptance_window', 'minutes', parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  How long gig workers have to accept or reject allocated cases
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="nudge-minutes">Nudge After (minutes)</Label>
                <Input
                  id="nudge-minutes"
                  type="number"
                  min="1"
                  max={config.acceptance_window.minutes - 1}
                  value={config.acceptance_window.nudge_after_minutes}
                  onChange={(e) => handleConfigChange('acceptance_window', 'nudge_after_minutes', parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  When to send reminder notifications to gig workers
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="max-waves">Maximum Reallocation Waves</Label>
                <Input
                  id="max-waves"
                  type="number"
                  min="1"
                  max="10"
                  value={config.acceptance_window.max_waves}
                  onChange={(e) => handleConfigChange('acceptance_window', 'max_waves', parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  Maximum number of times to try reallocating a case before marking as unallocated
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Capacity Rules Tab */}
        <TabsContent value="capacity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Capacity Rules
              </CardTitle>
              <CardDescription>
                Configure when capacity is consumed and freed for gig workers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Consume Capacity On</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {CONSUME_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={config.capacity_rules.consume_on === option.value ? "default" : "outline"}
                      onClick={() => handleConfigChange('capacity_rules', 'consume_on', option.value)}
                      className="justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  When to consume a gig worker's available capacity
                </p>
              </div>

              <div className="space-y-4">
                <Label>Free Capacity On</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {FREE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={config.capacity_rules.free_on === option.value ? "default" : "outline"}
                      onClick={() => handleConfigChange('capacity_rules', 'free_on', option.value)}
                      className="justify-start"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  When to free up a gig worker's capacity
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="reset-time">Daily Reset Time</Label>
                <Input
                  id="reset-time"
                  type="time"
                  value={config.capacity_rules.reset_time}
                  onChange={(e) => handleConfigChange('capacity_rules', 'reset_time', e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Time of day when all gig workers' capacity is reset
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="max-capacity">Default Max Daily Capacity</Label>
                <Input
                  id="max-capacity"
                  type="number"
                  min="1"
                  max="50"
                  value={config.capacity_rules.max_daily_capacity}
                  onChange={(e) => handleConfigChange('capacity_rules', 'max_daily_capacity', parseInt(e.target.value))}
                />
                <p className="text-sm text-muted-foreground">
                  Default maximum number of cases a gig worker can handle per day
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quality Thresholds Tab */}
        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Quality Thresholds
              </CardTitle>
              <CardDescription>
                Set minimum quality standards for gig workers to be eligible for allocation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Minimum Quality Score</Label>
                  <Badge variant="outline">
                    {(config.quality_thresholds.min_quality_score * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.quality_thresholds.min_quality_score * 100]}
                  onValueChange={(value) => handleSliderChange('quality_thresholds', 'min_quality_score', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum QC pass rate required for allocation eligibility
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Minimum Completion Rate</Label>
                  <Badge variant="outline">
                    {(config.quality_thresholds.min_completion_rate * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.quality_thresholds.min_completion_rate * 100]}
                  onValueChange={(value) => handleSliderChange('quality_thresholds', 'min_completion_rate', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum case completion rate required for allocation eligibility
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Minimum Acceptance Rate</Label>
                  <Badge variant="outline">
                    {(config.quality_thresholds.min_acceptance_rate * 100).toFixed(1)}%
                  </Badge>
                </div>
                <Slider
                  value={[config.quality_thresholds.min_acceptance_rate * 100]}
                  onValueChange={(value) => handleSliderChange('quality_thresholds', 'min_acceptance_rate', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum case acceptance rate required for allocation eligibility
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
