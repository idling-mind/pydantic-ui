export interface TableCellEditDetail {
	rowIndex: number;
	prop: string;
	val: unknown;
}

export interface TableCellOpenEditorDetail {
	rowIndex: number;
	prop: string;
}

export const TABLE_CELL_EDIT_EVENT = 'pydantic-ui-cell-edit';
export const TABLE_CELL_OPEN_EDITOR_EVENT = 'pydantic-ui-cell-open-editor';

function dispatchTableCellEvent<TDetail>(
	element: HTMLElement,
	eventName: string,
	detail: TDetail,
): void {
	// composed=true ensures events from within RevoGrid shadow roots reach the host listener.
	element.dispatchEvent(
		new CustomEvent<TDetail>(eventName, {
			bubbles: true,
			composed: true,
			detail,
		}),
	);
}

export function triggerCellEdit(
	element: HTMLElement,
	rowIndex: number,
	prop: string,
	val: unknown,
): void {
	dispatchTableCellEvent<TableCellEditDetail>(element, TABLE_CELL_EDIT_EVENT, {
		rowIndex,
		prop,
		val,
	});
}

export function triggerCellOpenEditor(
	element: HTMLElement,
	rowIndex: number,
	prop: string,
): void {
	dispatchTableCellEvent<TableCellOpenEditorDetail>(
		element,
		TABLE_CELL_OPEN_EDITOR_EVENT,
		{
			rowIndex,
			prop,
		},
	);
}
