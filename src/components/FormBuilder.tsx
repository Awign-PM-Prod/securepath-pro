import React, { useState, useEffect } from 'react';
import { FormBuilderTemplate, FormBuilderField, FormFieldType, FormFieldValidation } from '@/types/form';
import { formService } from '@/services/formService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface ContractType {
  id: string;
  type_key: string;
  display_name: string;
}

interface FormBuilderProps {
  contractTypeId?: string;
  contractTypes?: ContractType[];
  onSave: (template: FormBuilderTemplate) => void;
  onCancel: () => void;
  initialTemplate?: FormBuilderTemplate;
  isSaving?: boolean;
}

export const FormBuilder: React.FC<FormBuilderProps> = ({
  contractTypeId,
  contractTypes = [],
  onSave,
  onCancel,
  initialTemplate,
  isSaving = false
}) => {
  const [template, setTemplate] = useState<FormBuilderTemplate>({
    template_name: '',
    contract_type_id: contractTypeId,
    fields: [],
    is_negative: false
  });

  const [editingField, setEditingField] = useState<FormBuilderField | null>(null);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setTemplate({
        ...initialTemplate,
        is_negative: initialTemplate.is_negative ?? false
      });
    }
  }, [initialTemplate]);

  useEffect(() => {
    if (contractTypeId) {
      setTemplate(prev => ({
        ...prev,
        contract_type_id: contractTypeId
      }));
    }
  }, [contractTypeId]);

  const addField = () => {
    const newField: FormBuilderField = {
      field_key: '',
      field_title: '',
      field_type: 'short_answer',
      validation_type: 'mandatory',
      field_config: {},
      field_order: (template.fields || []).length
    };
    const newIndex = template.fields.length;
    // Add the field first, then edit it
    setTemplate(prev => ({
      ...prev,
      fields: [...prev.fields, newField]
    }));
    setEditingField(newField);
    setEditingFieldIndex(newIndex);
    setShowFieldEditor(true);
    
    // Scroll to the new field after a short delay
    setTimeout(() => {
      const fieldElement = document.getElementById(`field-${newIndex}`);
      if (fieldElement) {
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const editField = (index: number) => {
    setEditingField({ ...template.fields[index] });
    setEditingFieldIndex(index);
    setShowFieldEditor(true);
    
    // Scroll to the field being edited after a short delay to ensure DOM is updated
    setTimeout(() => {
      const fieldElement = document.getElementById(`field-${index}`);
      if (fieldElement) {
        fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const saveField = (field: FormBuilderField) => {
    if (editingField && editingFieldIndex !== null) {
      // Update the field at the editing index
      const updatedFields = [...template.fields];
      updatedFields[editingFieldIndex] = { ...field, field_order: editingFieldIndex };
      setTemplate(prev => ({ ...prev, fields: updatedFields }));
    }
    setEditingField(null);
    setEditingFieldIndex(null);
    setShowFieldEditor(false);
  };

  const deleteField = (index: number) => {
    // If deleting the field being edited, close the editor
    if (editingFieldIndex === index) {
      setEditingField(null);
      setEditingFieldIndex(null);
      setShowFieldEditor(false);
    }
    
    setTemplate(prev => ({
      ...prev,
      fields: (prev.fields || []).filter((_, i) => i !== index).map((field, i) => ({
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

    // Update editingFieldIndex if a field is being edited
    if (editingFieldIndex !== null) {
      if (result.source.index === editingFieldIndex) {
        // The field being edited was moved
        setEditingFieldIndex(result.destination.index);
      } else if (
        result.source.index < editingFieldIndex && 
        result.destination.index >= editingFieldIndex
      ) {
        // A field before the edited one was moved to after it
        setEditingFieldIndex(editingFieldIndex - 1);
      } else if (
        result.source.index > editingFieldIndex && 
        result.destination.index <= editingFieldIndex
      ) {
        // A field after the edited one was moved to before it
        setEditingFieldIndex(editingFieldIndex + 1);
      }
    }

    setTemplate(prev => ({ ...prev, fields: reorderedFields }));
  };

  const FieldEditor = () => {
    if (!editingField) return null;

    // Use local state for the field being edited to prevent re-renders
    const [localField, setLocalField] = useState<FormBuilderField>(editingField);
    // Store raw input value for multiple choice options (to allow free typing)
    const [multipleChoiceInput, setMultipleChoiceInput] = useState<string>(
      editingField.field_type === 'multiple_choice' 
        ? (editingField.field_config.options?.join(', ') || '')
        : ''
    );

    // Only update local field when editingField changes (when opening editor for different field)
    useEffect(() => {
      setLocalField(editingField);
      if (editingField.field_type === 'multiple_choice') {
        setMultipleChoiceInput(editingField.field_config.options?.join(', ') || '');
      } else {
        setMultipleChoiceInput('');
      }
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
      <div className="bg-white border-2 border-blue-300 rounded-lg shadow-lg z-40 my-4">
        <Card className="border-0 shadow-none">
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
                  <option value="signature">Signature</option>
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
              <div className="space-y-2">
                <Label>Options (comma-separated)</Label>
                <Input
                  value={multipleChoiceInput}
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Update the raw input value immediately (allows free typing)
                    setMultipleChoiceInput(rawValue);
                    // Parse and update options in the background
                    const options = rawValue
                      .split(',')
                      .map(opt => opt.trim())
                      .filter(opt => opt.length > 0);
                    updateFieldConfig({ options });
                  }}
                  onBlur={() => {
                    // On blur, clean up and format the input
                    const options = multipleChoiceInput
                      .split(',')
                      .map(opt => opt.trim())
                      .filter(opt => opt.length > 0);
                    const formatted = options.join(', ');
                    setMultipleChoiceInput(formatted);
                    updateFieldConfig({ options });
                  }}
                  placeholder="Option 1, Option 2, Option 3"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Enter options separated by commas (e.g., "Yes, No, Maybe")
                </p>
                {localField.field_config.options && localField.field_config.options.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded-md">
                    <p className="text-xs font-medium text-gray-700 mb-1">Preview ({localField.field_config.options.length} options):</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {localField.field_config.options.map((option, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center text-[10px]">{idx + 1}</span>
                          <span>{option}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
              <Button variant="outline" onClick={() => {
                setShowFieldEditor(false);
                setEditingField(null);
                setEditingFieldIndex(null);
              }}>
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
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="is_negative">Case Type</Label>
              <p className="text-sm text-muted-foreground">
                {template.is_negative ? 'Negative Case Template' : 'Positive Case Template'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Positive</span>
              <Switch
                id="is_negative"
                checked={template.is_negative ?? false}
                onCheckedChange={(checked) => setTemplate(prev => ({ ...prev, is_negative: checked }))}
              />
              <span className="text-sm font-medium">Negative</span>
            </div>
          </div>
          <div>
            <Label htmlFor="contract_type">Contract Type</Label>
            <select
              id="contract_type"
              value={template.contract_type_id || ''}
              onChange={(e) => setTemplate(prev => ({ ...prev, contract_type_id: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Contract Type</option>
              {contractTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.display_name}
                </option>
              ))}
            </select>
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
                  {(template.fields || []).map((field, index) => (
                    <div key={index}>
                      <Draggable draggableId={index.toString()} index={index}>
                        {(provided) => (
                          <div
                            id={`field-${index}`}
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
                      {/* Render editor inline after the field being edited */}
                      {editingFieldIndex === index && showFieldEditor && <FieldEditor />}
                    </div>
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
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={() => onSave(template)} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>

    </div>
  );
};
