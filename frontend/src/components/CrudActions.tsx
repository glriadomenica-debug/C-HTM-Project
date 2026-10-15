interface CrudActionsProps {
  canView?: boolean;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;

  onView?: () => void;
  onCreate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function CrudActions({
  canView = true,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  onView,
  onCreate,
  onEdit,
  onDelete,
}: CrudActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {canView && (
        <button
          type="button"
          onClick={onView}
          className="rounded-lg bg-blue-100 px-3 py-2 text-sm text-blue-800"
        >
          View
        </button>
      )}

      {canCreate && (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-lg bg-green-100 px-3 py-2 text-sm text-green-800"
        >
          Add
        </button>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800"
        >
          Edit
        </button>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800"
        >
          Delete
        </button>
      )}
    </div>
  );
}
