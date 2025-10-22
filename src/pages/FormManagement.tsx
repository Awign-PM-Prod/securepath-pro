import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Edit, Eye, Trash2, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formService } from '@/services/formService';
import { FormBuilder } from '@/components/FormBuilder';
import { FormTemplate } from '@/types/form';
import { supabase } from '@/integrations/supabase/client';

interface ContractType {
  id: string;
  type_key: string;
  display_name: string;
}

export default function FormManagement() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [selectedContractType, setSelectedContractType] = useState<string>('');
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [templateToPublish, setTemplateToPublish] = useState<FormTemplate | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
    loadContractTypes();
  }, []);

  const loadContractTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_type_config')
        .select('id, type_key, display_name')
        .eq('is_active', true)
        .order('display_name');
      
      if (error) throw error;
      setContractTypes(data || []);
    } catch (error) {
      console.error('Error loading contract types:', error);
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await formService.getAllFormTemplates();
      if (result.success && result.templates) {
        setTemplates(result.templates);
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to load form templates',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load form templates',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = () => {
    setSelectedContractType('');
    setEditingTemplate(null);
    setIsFormBuilderOpen(true);
  };

  const handleEditTemplate = (template: FormTemplate) => {
    // Convert FormTemplate to FormBuilderTemplate format
    const formBuilderTemplate = {
      template_name: template.template_name,
      contract_type_id: template.contract_type_id,
      fields: template.form_fields?.map(field => ({
        field_key: field.field_key,
        field_title: field.field_title,
        field_type: field.field_type,
        validation_type: field.validation_type,
        field_config: field.field_config,
        field_order: field.field_order,
        depends_on_field_id: field.depends_on_field_id,
        depends_on_value: field.depends_on_value
      })) || []
    };
    setEditingTemplate(formBuilderTemplate as any);
    setSelectedContractType(template.contract_type_id);
    setIsFormBuilderOpen(true);
  };

  const handleSaveTemplate = async (templateData: any) => {
    try {
      const result = await formService.createFormTemplate(templateData);
      if (result.success) {
        const message = editingTemplate 
          ? 'Form template updated successfully!' 
          : 'Form template created successfully!';
        toast({
          title: 'Success',
          description: message,
        });
        setIsFormBuilderOpen(false);
        setEditingTemplate(null);
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to save form template',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save form template',
        variant: 'destructive',
      });
    }
  };

  const handleCancelFormBuilder = () => {
    setIsFormBuilderOpen(false);
    setEditingTemplate(null);
    setSelectedContractType('');
  };

  const handlePublishTemplate = async (templateId: string, contractTypeKey: string) => {
    try {
      const result = await formService.publishFormTemplate(templateId, contractTypeKey);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Form template published successfully!',
        });
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to publish form template',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error publishing template:', error);
      toast({
        title: 'Error',
        description: 'Failed to publish form template',
        variant: 'destructive',
      });
    }
  };

  const handleUnpublishTemplate = async (templateId: string) => {
    try {
      const result = await formService.unpublishFormTemplate(templateId);
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Form template unpublished successfully!',
        });
        loadTemplates();
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to unpublish form template',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error unpublishing template:', error);
      toast({
        title: 'Error',
        description: 'Failed to unpublish form template',
        variant: 'destructive',
      });
    }
  };

  const handlePublishClick = (template: FormTemplate) => {
    setTemplateToPublish(template);
    setIsPublishDialogOpen(true);
  };

  const handlePublishConfirm = async () => {
    if (templateToPublish && selectedContractType) {
      await handlePublishTemplate(templateToPublish.id, selectedContractType);
      setIsPublishDialogOpen(false);
      setTemplateToPublish(null);
      setSelectedContractType('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading form templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Form Management</h1>
          <p className="text-gray-600">Create and manage dynamic forms for different contract types</p>
        </div>
        <Button onClick={handleCreateTemplate}>
          <Plus className="h-4 w-4 mr-2" />
          Create Form Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            No form templates found. Create your first form template to get started.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Form Templates</CardTitle>
            <CardDescription>
              Manage dynamic forms for different contract types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Contract Type</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.template_name}
                    </TableCell>
                    <TableCell>
                      {template.contract_type_config?.display_name ? (
                        <Badge variant="outline">
                          {template.contract_type_config.display_name}
                        </Badge>
                      ) : (
                        <span className="text-gray-500">Draft (No contract type)</span>
                      )}
                    </TableCell>
                    <TableCell>v{template.template_version}</TableCell>
                    <TableCell>
                      {template.form_fields?.length || 0} fields
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(template.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditTemplate(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!template.is_active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePublishClick(template)}
                          >
                            Publish
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnpublishTemplate(template.id)}
                          >
                            Unpublish
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Form Builder Dialog */}
      <Dialog open={isFormBuilderOpen} onOpenChange={setIsFormBuilderOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Form Template' : 'Create Form Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Modify the form template fields and configuration'
                : 'Create a new dynamic form template for contract verification'
              }
            </DialogDescription>
          </DialogHeader>
          <FormBuilder
            contractTypeId={selectedContractType}
            onSave={handleSaveTemplate}
            onCancel={handleCancelFormBuilder}
            initialTemplate={editingTemplate}
          />
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Form Template</DialogTitle>
            <DialogDescription>
              Select a contract type to publish "{templateToPublish?.template_name}" to. 
              This will unpublish any existing form for the selected contract type.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="contract-type">Contract Type</Label>
              <select
                id="contract-type"
                value={selectedContractType}
                onChange={(e) => setSelectedContractType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select Contract Type</option>
                {contractTypes.map((type) => (
                  <option key={type.id} value={type.type_key}>
                    {type.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePublishConfirm}
              disabled={!selectedContractType}
            >
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
