import React, { useState, useRef, useEffect } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { 
	DownloadIcon, 
	UploadIcon, 
	FileJsonIcon, 
	CheckCircle2Icon, 
	AlertTriangleIcon,
	XIcon,
	Loader2Icon,
	FileTextIcon,
	InfoIcon
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { API_ENDPOINTS } from '@/utils/constants';

/**
 * ImportExportSlot Component
 * 
 * This component handles the global Modals for both Importing and Exporting
 * table configurations and plugin settings.
 * 
 * It communicates with the Free plugin via the window.productbay bridge.
 */
const ImportExportSlot = () => {
	// Access bridge utilities
	const pb = (window as any).productbay;
	if (!pb || !pb.useImportExportStore) return null;

	const { 
		importModalOpen, 
		closeImportModal,
		exportModalOpen,
		closeExportModal,
		availableTables,
		exportTableIds,
		toggleTableSelection,
		setExportSelection
	} = pb.useImportExportStore();

	const { settings, updateSettings } = pb.useSettingsStore();
	const apiFetch = pb.apiFetch;

	// UI Components from bridge
	const { Modal, Button, Toggle, Select, Alert, Tooltip } = pb.ui;

	// -- Import State --
	const [importFile, setImportFile] = useState<File | null>(null);
	const [importStatus, setImportStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
	const [importMsg, setImportMsg] = useState('');
	const [importOptions, setImportOptions] = useState({
		overlapMode: 'create', // 'skip', 'overwrite', 'create'
		addImportedTitle: false,
	});
	const fileInputRef = useRef<HTMLInputElement>(null);

	// -- Export State --
	const [exportLoading, setExportLoading] = useState(false);
	const [includeSettings, setIncludeSettings] = useState(true);

	/**
	 * Handle File Selection for Import
	 */
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
				setImportStatus('error');
				setImportMsg(__('Please select a valid JSON file.', 'productbay-pro'));
				return;
			}
			setImportFile(file);
			setImportStatus('idle');
			setImportMsg('');
		}
	};

	/**
	 * Run the Import Process
	 */
	const handleRunImport = async () => {
		if (!importFile) return;

		setImportStatus('loading');
		setImportMsg(__('Processing import file...', 'productbay-pro'));

		try {
			const reader = new FileReader();
			reader.onload = async (e) => {
				try {
					const content = e.target?.result as string;
					const data = JSON.parse(content);

					// Trigger backend import
					const result = await apiFetch(API_ENDPOINTS.IMPORT, {
						method: 'POST',
						body: JSON.stringify({
							data,
							options: importOptions
						})
					});

					setImportStatus('success');
					setImportMsg(sprintf(
						__('Successfully imported %d tables and settings.', 'productbay-pro'),
						result.imported_count || 0
					));

					// Refresh tables list if we are on the tables page
					if (window.location.hash.includes('/tables')) {
						window.location.reload(); 
					}
				} catch (err: any) {
					setImportStatus('error');
					setImportMsg(err.message || __('Invalid import data format.', 'productbay-pro'));
				}
			};
			reader.readAsText(importFile);
		} catch (err) {
			setImportStatus('error');
			setImportMsg(__('Failed to read the import file.', 'productbay-pro'));
		}
	};

	/**
	 * Run the Export Process
	 */
	const handleRunExport = async () => {
		if (exportTableIds.length === 0 && !includeSettings) {
			return;
		}

		setExportLoading(true);
		try {
			const result = await apiFetch(API_ENDPOINTS.EXPORT, {
				method: 'POST',
				body: JSON.stringify({
					table_ids: exportTableIds,
					include_settings: includeSettings
				})
			});

			// Create a download link for the JSON
			const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `productbay-export-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(url);

			closeExportModal();
		} catch (err) {
			console.error('Export failed', err);
		} finally {
			setExportLoading(false);
		}
	};

	/**
	 * Reset Import state on close
	 */
	useEffect(() => {
		if (!importModalOpen) {
			setImportFile(null);
			setImportStatus('idle');
			setImportMsg('');
		}
	}, [importModalOpen]);

	// Render Modals
	return (
		<>
			{/* --- IMPORT MODAL --- */}
			<Modal
				isOpen={importModalOpen}
				onClose={closeImportModal}
				title={__('Import Tables & Settings', 'productbay-pro')}
				className="max-w-xl"
			>
				<div className="space-y-6">
					{importStatus === 'success' ? (
						<div className="text-center py-8 space-y-4">
							<div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
								<CheckCircle2Icon className="size-10" />
							</div>
							<h3 className="text-xl font-bold text-gray-900">{__('Import Complete!', 'productbay-pro')}</h3>
							<p className="text-gray-600">{importMsg}</p>
							<Button onClick={closeImportModal} className="mt-4">
								{__('Close', 'productbay-pro')}
							</Button>
						</div>
					) : (
						<>
							{/* File Dropzone / Selector */}
							<div 
								onClick={() => fileInputRef.current?.click()}
								className={cn(
									"border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all bg-gray-50 hover:bg-blue-50 border-gray-200 hover:border-blue-400 group",
									importFile && "border-blue-500 bg-blue-50/30"
								)}
							>
								<input 
									type="file" 
									ref={fileInputRef} 
									className="hidden" 
									accept=".json"
									onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFileChange(e)}
								/>
								
								{importFile ? (
									<div className="flex flex-col items-center">
										<div className="bg-blue-500 text-white p-3 rounded-lg mb-3 shadow-lg">
											<FileJsonIcon className="size-8" />
										</div>
										<span className="font-bold text-blue-900">{importFile.name}</span>
										<span className="text-xs text-blue-600 mt-1">{(importFile.size / 1024).toFixed(2)} KB</span>
										<button 
											type="button"
											onClick={(e: React.MouseEvent) => {
												e.stopPropagation();
												setImportFile(null);
											}}
											className="mt-4 text-xs text-red-500 hover:underline flex items-center gap-1"
										>
											<XIcon className="size-3" /> {__('Remove file', 'productbay-pro')}
										</button>
									</div>
								) : (
									<div className="flex flex-col items-center">
										<div className="bg-white border border-gray-200 p-3 rounded-lg mb-4 shadow-sm group-hover:scale-110 transition-transform">
											<UploadIcon className="size-8 text-gray-400 group-hover:text-blue-500" />
										</div>
										<span className="text-gray-900 font-bold text-lg mb-1">{__('Drop JSON file here', 'productbay-pro')}</span>
										<span className="text-gray-500 text-sm">{__('or click to browse from your computer', 'productbay-pro')}</span>
									</div>
								)}
							</div>

							{/* Import Options */}
							<div className="space-y-4 pt-4 border-t border-gray-100">
								<h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{__('Import Options', 'productbay-pro')}</h4>
								
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<label className="text-xs font-bold text-gray-700">{__('Conflict Resolution', 'productbay-pro')}</label>
										<Select 
											value={importOptions.overlapMode}
											onChange={(val: string) => setImportOptions(prev => ({ ...prev, overlapMode: val }))}
											options={[
												{ label: __('Create New (Keep both)', 'productbay-pro'), value: 'create' },
												{ label: __('Overwrite Existing', 'productbay-pro'), value: 'overwrite' },
												{ label: __('Skip Duplicates', 'productbay-pro'), value: 'skip' },
											]}
										/>
									</div>
									<div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
										<div className="flex flex-col">
											<span className="text-xs font-bold text-gray-900">{__('Rename Imported', 'productbay-pro')}</span>
											<span className="text-[10px] text-gray-500">{__('Add "(Imported)" to titles', 'productbay-pro')}</span>
										</div>
										<Toggle 
											checked={importOptions.addImportedTitle}
											onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportOptions(prev => ({ ...prev, addImportedTitle: e.target.checked }))}
										/>
									</div>
								</div>
							</div>

							{importStatus === 'error' && (
								<Alert variant="destructive" className="mt-4">
									{importMsg}
								</Alert>
							)}

							{/* Actions */}
							<div className="flex justify-end gap-3 pt-6">
								<Button variant="ghost" onClick={closeImportModal} disabled={importStatus === 'loading'}>
									{__('Cancel', 'productbay-pro')}
								</Button>
								<Button 
									onClick={handleRunImport} 
									disabled={!importFile || importStatus === 'loading'}
									className="px-8 min-w-[140px]"
								>
									{importStatus === 'loading' ? (
										<><Loader2Icon className="size-4 mr-2 animate-spin" /> {__('Importing...', 'productbay-pro')}</>
									) : (
										__('Start Import', 'productbay-pro')
									)}
								</Button>
							</div>
						</>
					)}
				</div>
			</Modal>

			{/* --- EXPORT MODAL --- */}
			<Modal
				isOpen={exportModalOpen}
				onClose={closeExportModal}
				title={__('Export Tables & Settings', 'productbay-pro')}
				className="max-w-2xl"
			>
				<div className="space-y-6">
					<div className="flex items-center justify-between">
						<div>
							<h4 className="text-sm font-bold text-gray-900 uppercase tracking-widest">{__('Select Items to Export', 'productbay-pro')}</h4>
							<p className="text-xs text-gray-500 mt-1">{__('Choose which tables and configurations you want to include in the package.', 'productbay-pro')}</p>
						</div>
						<Button 
							variant="outline" 
							size="xs"
							onClick={() => {
								const allIds = availableTables.map((t: any) => t.id).filter(Boolean);
								const isAllSelected = exportTableIds.length === allIds.length;
								setExportSelection(isAllSelected ? [] : allIds);
							}}
						>
							{exportTableIds.length === availableTables.length ? __('Deselect All', 'productbay-pro') : __('Select All', 'productbay-pro')}
						</Button>
					</div>

					{/* Global Settings Export Toggle */}
					<div className="bg-orange-50 border border-orange-100 rounded-xl p-4 flex items-center justify-between group hover:bg-orange-100/50 transition-colors">
						<div className="flex items-center gap-3">
							<div className="bg-orange-500 text-white p-2 rounded-lg shadow-sm">
								<FileTextIcon className="size-5" />
							</div>
							<div>
								<span className="block font-bold text-orange-900 text-sm">{__('Plugin Global Settings', 'productbay-pro')}</span>
								<span className="block text-[11px] text-orange-700/70">{__('Includes general, API, and appearance defaults', 'productbay-pro')}</span>
							</div>
						</div>
						<Toggle 
							checked={includeSettings}
							onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeSettings(e.target.checked)}
						/>
					</div>

					{/* Tables List */}
					<div className="space-y-2 max-h-[350px] overflow-y-auto px-1 custom-scrollbar">
						{availableTables.length === 0 ? (
							<div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
								<p className="text-gray-400 text-sm">{__('No tables found to export.', 'productbay-pro')}</p>
							</div>
						) : (
							availableTables.map((table: any) => (
								<div 
									key={table.id}
									onClick={() => toggleTableSelection(table.id)}
									className={cn(
										"flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all",
										exportTableIds.includes(table.id) 
											? "bg-blue-50 border-blue-200" 
											: "bg-white border-gray-100 hover:border-gray-200"
									)}
								>
									<div className="flex items-center gap-3">
										<div className={cn(
											"w-5 h-5 rounded border flex items-center justify-center transition-colors",
											exportTableIds.includes(table.id) ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
										)}>
											{exportTableIds.includes(table.id) && <CheckCircle2Icon className="size-3.5 text-white" />}
										</div>
										<div>
											<span className="block font-bold text-gray-900 text-sm">{table.title}</span>
											<span className="block text-[10px] text-gray-500 uppercase tracking-tighter">
												ID: {table.id} • {table.columns?.length || 0} {__('Columns', 'productbay-pro')}
											</span>
										</div>
									</div>
									{table.status === 'publish' ? (
										<span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full uppercase">
											{__('Published', 'productbay-pro')}
										</span>
									) : (
										<span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
											{__('Private', 'productbay-pro')}
										</span>
									)}
								</div>
							))
						)}
					</div>

					{/* Summary and Warning */}
					<div className="bg-blue-50/50 border border-blue-100 rounded-lg p-3 flex items-start gap-3">
						<InfoIcon className="size-4 text-blue-500 mt-0.5 shrink-0" />
						<p className="text-[11px] text-blue-700 leading-relaxed">
							{__('Exporting generates a .json file containing the selected data. You can import this file into any other WooCommerce site with ProductBay installed.', 'productbay-pro')}
						</p>
					</div>

					{/* Footer Actions */}
					<div className="flex items-center justify-between pt-4 border-t border-gray-100">
						<div className="text-sm font-bold text-gray-700">
							{exportTableIds.length} {__('Tables Selected', 'productbay-pro')}
						</div>
						<div className="flex gap-3">
							<Button variant="ghost" onClick={closeExportModal} disabled={exportLoading}>
								{__('Cancel', 'productbay-pro')}
							</Button>
							<Button 
								onClick={handleRunExport} 
								disabled={exportLoading || (exportTableIds.length === 0 && !includeSettings)}
								className="min-w-[160px]"
							>
								{exportLoading ? (
									<><Loader2Icon className="size-4 mr-2 animate-spin" /> {__('Preparing...', 'productbay-pro')}</>
								) : (
									<><DownloadIcon className="size-4 mr-2" /> {__('Generate Export', 'productbay-pro')}</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</Modal>
		</>
	);
};

export default ImportExportSlot;
