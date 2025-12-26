import { useState } from 'react'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useTheme } from '@/components/theme-provider'
import type { Category, CategoryType } from '../../../shared/types'

interface SettingsViewProps {
  categories: Category[]
  onRefreshCategories: () => Promise<void>
}

const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'GIVING', label: 'Giving' },
  { value: 'SAVINGS', label: 'Savings' },
  { value: 'NEEDS', label: 'Essentials' },
  { value: 'WANTS', label: 'Lifestyle' },
  { value: 'DEBT', label: 'Debt' }
]

export function SettingsView({ categories, onRefreshCategories }: SettingsViewProps) {
  const { theme, setTheme } = useTheme()
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Customize your budget experience</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Budgit looks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={theme}
              onValueChange={(value: 'light' | 'dark' | 'system') => setTheme(value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Manage your budget categories</CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowAddCategory(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Category
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div key={category.id}>
                {index > 0 && <Separator className="my-2" />}
                <div className="flex items-center justify-between py-2 group">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {CATEGORY_TYPES.find((t) => t.value === category.type)?.label}
                        {category.rolloverEnabled && ' • Rollover enabled'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingCategory(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700"
                      onClick={() => setDeleteConfirm(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Budgit</strong> - Family Budget Tracker
          </p>
          <p>Version 1.0.0</p>
          <p>Zero-based budgeting for families. Give every dollar a job.</p>
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <CategoryDialog
        open={showAddCategory}
        onOpenChange={setShowAddCategory}
        onSave={async (data) => {
          await window.api.addCategory({
            ...data,
            sortOrder: categories.length
          })
          await onRefreshCategories()
          setShowAddCategory(false)
        }}
      />

      {/* Edit Category Dialog */}
      <CategoryDialog
        open={!!editingCategory}
        onOpenChange={(open) => !open && setEditingCategory(null)}
        category={editingCategory || undefined}
        onSave={async (data) => {
          if (editingCategory) {
            await window.api.updateCategory(editingCategory.id, data)
            await onRefreshCategories()
          }
          setEditingCategory(null)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this category? Transactions in this category will
              become uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteConfirm) {
                  await window.api.deleteCategory(deleteConfirm)
                  await onRefreshCategories()
                }
                setDeleteConfirm(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface CategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category
  onSave: (data: Omit<Category, 'id' | 'sortOrder'>) => Promise<void>
}

function CategoryDialog({ open, onOpenChange, category, onSave }: CategoryDialogProps) {
  const [name, setName] = useState(category?.name || '')
  const [type, setType] = useState<CategoryType>(category?.type || 'NEEDS')
  const [rolloverEnabled, setRolloverEnabled] = useState(category?.rolloverEnabled || false)
  const [saving, setSaving] = useState(false)

  // Reset form when category changes
  useState(() => {
    if (category) {
      setName(category.name)
      setType(category.type)
      setRolloverEnabled(category.rolloverEnabled)
    } else {
      setName('')
      setType('NEEDS')
      setRolloverEnabled(false)
    }
  })

  const handleSave = async () => {
    if (!name.trim()) return

    setSaving(true)
    await onSave({
      name: name.trim(),
      type,
      rolloverEnabled
    })
    setSaving(false)

    // Reset form
    setName('')
    setType('NEEDS')
    setRolloverEnabled(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? 'Edit' : 'Add'} Category</DialogTitle>
          <DialogDescription>
            {category ? 'Update the category details' : 'Create a new budget category'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Groceries"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value: CategoryType) => setType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rollover"
              checked={rolloverEnabled}
              onChange={(e) => setRolloverEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="rollover" className="text-sm font-normal">
              Enable rollover (carry unused funds to next month)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!name.trim() || saving} onClick={handleSave}>
            {saving ? 'Saving...' : category ? 'Update' : 'Add'} Category
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
