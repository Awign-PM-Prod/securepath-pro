import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy, 
  DollarSign,
  MapPin,
  Clock,
  Eye
} from 'lucide-react';
import { RateCard } from '@/services/rateCardService';

interface RateCardListProps {
  rateCards: RateCard[];
  onEditRateCard: (rateCard: RateCard) => void;
  onDeleteRateCard: (rateCardId: string) => void;
  onDuplicateRateCard: (rateCard: RateCard) => void;
  onCreateRateCard: () => void;
  isLoading?: boolean;
}

const PINCODE_TIER_LABELS = {
  tier_1: 'Tier 1 (Metro)',
  tier_2: 'Tier 2 (Tier-2)',
  tier_3: 'Tier 3 (Rural)',
};

const COMPLETION_SLAB_LABELS = {
  within_24h: '24 Hours',
  within_48h: '48 Hours',
  within_72h: '72 Hours',
  within_1w: '1 Week',
};

const PINCODE_TIER_COLORS = {
  tier_1: 'bg-blue-100 text-blue-800',
  tier_2: 'bg-green-100 text-green-800',
  tier_3: 'bg-orange-100 text-orange-800',
};

const COMPLETION_SLAB_COLORS = {
  within_24h: 'bg-red-100 text-red-800',
  within_48h: 'bg-yellow-100 text-yellow-800',
  within_72h: 'bg-blue-100 text-blue-800',
  within_1w: 'bg-gray-100 text-gray-800',
};

export default function RateCardList({ 
  rateCards, 
  onEditRateCard, 
  onDeleteRateCard, 
  onDuplicateRateCard,
  onCreateRateCard, 
  isLoading = false 
}: RateCardListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [slabFilter, setSlabFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRateCards = rateCards.filter(rateCard => {
    const matchesSearch = 
      rateCard.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rateCard.pincode_tier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rateCard.completion_slab.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTier = tierFilter === 'all' || rateCard.pincode_tier === tierFilter;
    const matchesSlab = slabFilter === 'all' || rateCard.completion_slab === slabFilter;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && rateCard.is_active) ||
      (statusFilter === 'inactive' && !rateCard.is_active);
    
    return matchesSearch && matchesTier && matchesSlab && matchesStatus;
  });

  const getTierBadge = (tier: keyof typeof PINCODE_TIER_LABELS) => (
    <Badge className={PINCODE_TIER_COLORS[tier]}>
      {PINCODE_TIER_LABELS[tier]}
    </Badge>
  );

  const getSlabBadge = (slab: keyof typeof COMPLETION_SLAB_LABELS) => (
    <Badge className={COMPLETION_SLAB_COLORS[slab]}>
      {COMPLETION_SLAB_LABELS[slab]}
    </Badge>
  );

  const getTotalRate = (rateCard: RateCard) => {
    return rateCard.base_rate_inr + rateCard.travel_allowance_inr + rateCard.bonus_inr;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rate Cards</CardTitle>
          <CardDescription>Loading rate cards...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rate Cards</CardTitle>
            <CardDescription>
              Manage pricing and rate cards ({filteredRateCards.length} of {rateCards.length})
            </CardDescription>
          </div>
          <Button onClick={onCreateRateCard} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Rate Card
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search rate cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="tier_1">Tier 1</SelectItem>
                <SelectItem value="tier_2">Tier 2</SelectItem>
                <SelectItem value="tier_3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={slabFilter} onValueChange={setSlabFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Slab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Slabs</SelectItem>
                <SelectItem value="within_24h">24h</SelectItem>
                <SelectItem value="within_48h">48h</SelectItem>
                <SelectItem value="within_72h">72h</SelectItem>
                <SelectItem value="within_1w">1w</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Rate Cards Table */}
        {filteredRateCards.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No rate cards found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm || tierFilter !== 'all' || slabFilter !== 'all' || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by creating your first rate card'
              }
            </p>
            {!searchTerm && tierFilter === 'all' && slabFilter === 'all' && statusFilter === 'all' && (
              <Button onClick={onCreateRateCard}>
                <Plus className="h-4 w-4 mr-2" />
                Create Rate Card
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Completion Slab</TableHead>
                  <TableHead>Base Rate</TableHead>
                  <TableHead>Travel Allowance</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Total Rate</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRateCards.map((rateCard) => (
                  <TableRow key={rateCard.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {rateCard.name}
                    </TableCell>
                    <TableCell>
                      {getTierBadge(rateCard.pincode_tier as keyof typeof PINCODE_TIER_LABELS)}
                    </TableCell>
                    <TableCell>
                      {getSlabBadge(rateCard.completion_slab as keyof typeof COMPLETION_SLAB_LABELS)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">₹{rateCard.base_rate_inr.toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>₹{rateCard.travel_allowance_inr.toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>₹{rateCard.bonus_inr.toFixed(2)}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-lg">
                        ₹{getTotalRate(rateCard).toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={rateCard.is_active ? "default" : "secondary"}>
                        {rateCard.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditRateCard(rateCard)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onDuplicateRateCard(rateCard)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => onDeleteRateCard(rateCard.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

