import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calculator, 
  MapPin, 
  Clock, 
  DollarSign, 
  TrendingUp,
  RefreshCw,
  Copy
} from 'lucide-react';
import { rateCardService, RateCalculation } from '@/services/rateCardService';
import { useToast } from '@/hooks/use-toast';

const COMPLETION_SLABS = [
  { value: 'within_24h', label: 'Within 24 Hours', multiplier: 1.2 },
  { value: 'within_48h', label: 'Within 48 Hours', multiplier: 1.0 },
  { value: 'within_72h', label: 'Within 72 Hours', multiplier: 0.9 },
  { value: 'within_1w', label: 'Within 1 Week', multiplier: 0.8 },
];

const PINCODE_TIERS = [
  { value: 'tier_1', label: 'Tier 1 (Metro Cities)', color: 'bg-blue-100 text-blue-800' },
  { value: 'tier_2', label: 'Tier 2 (Tier-2 Cities)', color: 'bg-green-100 text-green-800' },
  { value: 'tier_3', label: 'Tier 3 (Rural Areas)', color: 'bg-orange-100 text-orange-800' },
];

export default function RateCalculator() {
  const [pincode, setPincode] = useState('');
  const [completionSlab, setCompletionSlab] = useState<'within_24h' | 'within_48h' | 'within_72h' | 'within_1w'>('within_48h');
  const [baseRate, setBaseRate] = useState<number | undefined>();
  const [qualityScore, setQualityScore] = useState<number | undefined>();
  const [demandLevel, setDemandLevel] = useState<number | undefined>();
  const [distanceKm, setDistanceKm] = useState<number | undefined>();
  
  const [calculation, setCalculation] = useState<RateCalculation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [detectedTier, setDetectedTier] = useState<string>('');
  
  const { toast } = useToast();

  useEffect(() => {
    if (pincode) {
      const tier = rateCardService.getPincodeTier(pincode);
      setDetectedTier(tier);
    }
  }, [pincode]);

  const handleCalculate = async () => {
    if (!pincode) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a pincode',
        variant: 'destructive',
      });
      return;
    }

    setIsCalculating(true);
    try {
      const result = await rateCardService.calculateRate(
        pincode,
        completionSlab,
        baseRate,
        qualityScore,
        demandLevel,
        distanceKm
      );
      
      setCalculation(result);
    } catch (error) {
      console.error('Rate calculation failed:', error);
      toast({
        title: 'Calculation Error',
        description: 'Failed to calculate rate. Please check your inputs.',
        variant: 'destructive',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCopyResult = () => {
    if (calculation) {
      const text = `Rate Calculation:
Base Rate: ₹${calculation.base_rate}
Travel Allowance: ₹${calculation.travel_allowance}
Bonus: ₹${calculation.bonus}
Total Rate: ₹${calculation.total_rate}

Breakdown:
${calculation.breakdown.base_calculation}
${calculation.breakdown.adjustments.map(adj => `- ${adj}`).join('\n')}`;
      
      navigator.clipboard.writeText(text);
      toast({
        title: 'Copied',
        description: 'Rate calculation copied to clipboard',
      });
    }
  };

  const resetForm = () => {
    setPincode('');
    setCompletionSlab('within_48h');
    setBaseRate(undefined);
    setQualityScore(undefined);
    setDemandLevel(undefined);
    setDistanceKm(undefined);
    setCalculation(null);
    setDetectedTier('');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Rate Calculator
          </CardTitle>
          <CardDescription>
            Calculate dynamic rates based on location, completion time, and other factors
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Input Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="Enter pincode"
                  maxLength={6}
                />
                {detectedTier && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <Badge className={PINCODE_TIERS.find(t => t.value === detectedTier)?.color}>
                      {PINCODE_TIERS.find(t => t.value === detectedTier)?.label}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="completion_slab">Completion Slab *</Label>
                <Select value={completionSlab} onValueChange={(value: any) => setCompletionSlab(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPLETION_SLABS.map((slab) => (
                      <SelectItem key={slab.value} value={slab.value}>
                        <div className="flex items-center justify-between w-full">
                          <span>{slab.label}</span>
                          <Badge variant="outline" className="ml-2">
                            {slab.multiplier}x
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="base_rate">Base Rate (₹) - Optional</Label>
                <Input
                  id="base_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={baseRate || ''}
                  onChange={(e) => setBaseRate(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Leave empty for default"
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use default rate from rate card
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="quality_score">Quality Score (0-1) - Optional</Label>
                <Input
                  id="quality_score"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={qualityScore || ''}
                  onChange={(e) => setQualityScore(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.85"
                />
                <p className="text-xs text-muted-foreground">
                  Higher quality scores may result in bonus rates
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="demand_level">Demand Level (0-1) - Optional</Label>
                <Input
                  id="demand_level"
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={demandLevel || ''}
                  onChange={(e) => setDemandLevel(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.7"
                />
                <p className="text-xs text-muted-foreground">
                  Higher demand may result in premium rates
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="distance_km">Distance (km) - Optional</Label>
                <Input
                  id="distance_km"
                  type="number"
                  min="0"
                  step="0.1"
                  value={distanceKm || ''}
                  onChange={(e) => setDistanceKm(e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="5.2"
                />
                <p className="text-xs text-muted-foreground">
                  Distance from gig worker to case location
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button onClick={handleCalculate} disabled={isCalculating || !pincode}>
              {isCalculating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Rate
                </>
              )}
            </Button>
            <Button variant="outline" onClick={resetForm}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Result */}
      {calculation && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Rate Calculation Result
                </CardTitle>
                <CardDescription>
                  Calculated rate breakdown and details
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyResult}>
                <Copy className="h-4 w-4 mr-2" />
                Copy Result
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total Rate */}
            <div className="text-center p-6 bg-primary/5 rounded-lg">
              <div className="text-3xl font-bold text-primary">
                ₹{calculation.total_rate.toFixed(2)}
              </div>
              <p className="text-muted-foreground">Total Rate</p>
            </div>

            {/* Rate Breakdown */}
            <div className="space-y-3">
              <h4 className="font-medium">Rate Breakdown</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Base Rate:</span>
                  <span className="font-medium">₹{calculation.base_rate.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Travel Allowance:</span>
                  <span className="font-medium">₹{calculation.travel_allowance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bonus:</span>
                  <span className="font-medium">₹{calculation.bonus.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>₹{calculation.total_rate.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Calculation Details */}
            <div className="space-y-3">
              <h4 className="font-medium">Calculation Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>Pincode Tier: <Badge variant="outline">{calculation.breakdown.pincode_tier}</Badge></span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Completion Slab: <Badge variant="outline">{calculation.breakdown.completion_slab}</Badge></span>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium mb-1">Base Calculation:</p>
                  <p className="text-muted-foreground">{calculation.breakdown.base_calculation}</p>
                </div>
                {calculation.breakdown.adjustments.length > 0 && (
                  <div>
                    <p className="font-medium mb-1">Adjustments:</p>
                    <ul className="space-y-1">
                      {calculation.breakdown.adjustments.map((adjustment, index) => (
                        <li key={index} className="text-muted-foreground">• {adjustment}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

