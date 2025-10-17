import React, { useState, useEffect } from 'react';
import { FormBuilderTemplate, FormBuilderField, FormFieldType, FormFieldValidation } from '@/types/form';
import { formService } from '@/services/formService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface FormBuilderProps {
  contractTypeId: string;
  onSave: (template: FormBuilderTemplate) => void;
  onCancel: () => void;
  initialTemplate?: FormBuilderTemplate;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  contractTypeId,
  onSave,
  onCancel,
  initialTemplate
}) => {
  const [template, setTemplate] = useState<FormBuilderTemplate>({
    template_name: '',
    contract_type_id: contractTypeId,
    fields: []
  });

  const [editingField, setEditingField] = useState<FormBuilderField | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate);
    }
  }, [initialTemplate]);

  const addField = () => {
    const newField: FormBuilderField = {
      field_key: '',
      field_title: '',
      field_type: 'short_answer',
      validation_type: 'mandatory',
      field_config: {},
      field_order: template.fields.length
    };
    setEditingField(newField);
    setShowFieldEditor(true);
  };

  const editField = (index: number) => {
    setEditingField({ ...template.fields[index] });
    setShowFieldEditor(true);
  };

  const saveField = (field: FormBuilderField) => {
    if (editingField) {
      const fieldIndex = template.fields.findIndex(f => f.field_order === editingField.field_order);
      if (fieldIndex >= 0) {
        // Update existing field
        const updatedFields = [...template.fields];
        updatedFields[fieldIndex] = { ...field, field_order: editingField.field_order };
        setTemplate(prev => ({ ...prev, fields: updatedFields }));
      } else {
        // Add new field
        setTemplate(prev => ({
          ...prev,
          fields: [...prev.fields, { ...field, field_order: prev.fields.length }]
        }));
      }
    }
    setEditingField(null);
    setShowFieldEditor(false);
  };

  const deleteField = (index: number) => {
    setTemplate(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index).map((field, i) => ({
        ...field,
        field_order: i
      }))
    }));
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(template.fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update field orders
    const reorderedFields = items.map((field, index) => ({
      ...field,
      field_order: index
    }));

    setTemplate(prev => ({ ...prev, fields: reorderedFields }));
  };

  const FieldEditor = () => {
    if (!editingField) return null;

    // Use local state for the field being edited to prevent re-renders
    const [localField, setLocalField] = useState<FormBuilderField>(editingField);

    // Only update local field when editingField changes (when opening editor for different field)
    useEffect(() => {
      setLocalField(editingField);
    }, [editingField?.field_order]); // Only reset when field_order changes (different field)

    const updateField = (updates: Partial<FormBuilderField>) => {
      // Update local state first for immediate UI update
      setLocalField(prev => ({ ...prev, ...updates }));
      // Don't update parent state immediately to prevent re-renders
    };

    const updateFieldConfig = (config: any) => {
      // Update local state first for immediate UI update
      setLocalField(prev => ({
        ...prev,
        field_config: { ...prev.field_config, ...config }
      }));
      // Don't update parent state immediately to prevent re-renders
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <CardHeader>
            <CardTitle>Edit Field</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="field_key">Field Key</Label>
                <Input
                  id="field_key"
                  value={localField.field_key}
                  onChange={(e) => updateField({ field_key: e.target.value })}
                  placeholder="e.g., was_entry_allowed"
                />
              </div>
              <div>
                <Label htmlFor="field_title">Field Title</Label>
                <Input
                  id="field_title"
                  value={localField.field_title}
                  onChange={(e) => updateField({ field_title: e.target.value })}
                  placeholder="e.g., Was entry allowed into the premises?"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="field_type">Field Type</Label>
                <select
                  id="field_type"
                  value={localField.field_type}
                  onChange={(e) => {
                    console.log('Field type changed to:', e.target.value);
                    updateField({ field_type: e.target.value as FormFieldType });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="short_answer">Short Answer</option>
                  <option value="paragraph">Paragraph</option>
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="file_upload">File Upload</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                </select>
                <div className="text-xs text-gray-500 mt-1">
                  Current value: {localField.field_type}
                </div>
              </div>
              <div>
                <Label htmlFor="validation_type">Validation Type</Label>
                <select
                  id="validation_type"
                  value={localField.validation_type}
                  onChange={(e) => {
                    console.log('Validation type changed to:', e.target.value);
                    updateField({ validation_type: e.target.value as FormFieldValidation });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="mandatory">Mandatory</option>
                  <option value="optional">Optional</option>
                  <option value="conditional">Conditional</option>
                </select>
              </div>
            </div>

            {/* Field-specific configuration */}
            {localField.field_type === 'multiple_choice' && (
              <div>
                <Label>Options (one per line)</Label>
                <Textarea
                  value={localField.field_config.options?.join('\n') || ''}
                  onChange={(e) => updateFieldConfig({
                    options: e.target.value.split('\n').filter(opt => opt.trim())
                  })}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  rows={4}
                />
              </div>
            )}

            {localField.field_type === 'file_upload' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="max_files">Max Files</Label>
                  <Input
                    id="max_files"
                    type="number"
                    value={localField.field_config.maxFiles || 1}
                    onChange={(e) => updateFieldConfig({ maxFiles: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label htmlFor="max_size">Max Size (MB)</Label>
                  <Input
                    id="max_size"
                    type="number"
                    value={localField.field_config.maxSizeMB || 10}
                    onChange={(e) => updateFieldConfig({ maxSizeMB: parseInt(e.target.value) || 10 })}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={localField.field_config.description || ''}
                onChange={(e) => updateFieldConfig({ description: e.target.value })}
                placeholder="Help text for this field"
                rows={2}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFieldEditor(false)}>
                Cancel
              </Button>
              <Button onClick={() => saveField(localField)}>
                Save Field
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Form Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="template_name">Template Name</Label>
            <Input
              id="template_name"
              value={template.template_name}
              onChange={(e) => setTemplate(prev => ({ ...prev, template_name: e.target.value }))}
              placeholder="e.g., Business Address Verification Form"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form Fields</CardTitle>
        </CardHeader>
        <CardContent>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="fields">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {template.fields.map((field, index) => (
                    <Draggable key={index} draggableId={index.toString()} index={index}>
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className="flex items-center space-x-2 p-3 border rounded-lg bg-white"
                        >
                          <div {...provided.dragHandleProps} className="cursor-grab">
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{field.field_title}</div>
                            <div className="text-sm text-gray-500">
                              {field.field_type} • {field.validation_type}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editField(index)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteField(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          <Button onClick={addField} className="w-full mt-4">
            <Plus className="h-4 w-4 mr-2" />
            Add Field
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSave(template)}>
          Save Template
        </Button>
      </div>

      {showFieldEditor && <FieldEditor />}
    </div>
  );
};
