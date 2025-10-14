import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export function TestSelect() {
  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Select Dropdown Test</h2>
      
      {/* Test 1: Select outside modal */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Test 1: Select outside modal</h3>
        <Select>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option 1</SelectItem>
            <SelectItem value="option2">Option 2</SelectItem>
            <SelectItem value="option3">Option 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Test 2: Select inside modal */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2">Test 2: Select inside modal</h3>
        <Dialog>
          <DialogTrigger asChild>
            <Button>Open Modal with Select</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Modal</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>This modal contains a Select dropdown. Try clicking it:</p>
              <Select>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select an option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modal-option1">Modal Option 1</SelectItem>
                  <SelectItem value="modal-option2">Modal Option 2</SelectItem>
                  <SelectItem value="modal-option3">Modal Option 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
