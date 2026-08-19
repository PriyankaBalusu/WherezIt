import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { acquireContainerBarcodeIdentifier, BarcodeIdentifierResponse } from '../api/barcodeApi';

interface PrintBarcodeLabelModalProps {
  workspaceId: string;
  containerId: string;
  boxDisplayId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintBarcodeLabelModal: React.FC<PrintBarcodeLabelModalProps> = ({
  workspaceId,
  containerId,
  boxDisplayId,
  isOpen,
  onClose,
}) => {
  const [identifier, setIdentifier] = useState<BarcodeIdentifierResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen && workspaceId && containerId) {
      setIsLoading(true);
      setError(null);
      acquireContainerBarcodeIdentifier(workspaceId, containerId)
        .then((data) => {
          setIdentifier(data);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Failed to acquire barcode');
          setIsLoading(false);
        });
    }
  }, [isOpen, workspaceId, containerId]);

  useEffect(() => {
    if (identifier && svgRef.current) {
      try {
        JsBarcode(svgRef.current, identifier.value, {
          format: 'CODE128',
          displayValue: false,
          margin: 10,
          height: 50,
        });
      } catch (err) {
        console.error('JsBarcode rendering error:', err);
      }
    }
  }, [identifier]);

  const handleRevoke = async () => {
    if (!identifier) return;
    const confirmed = window.confirm('Revoke this label? Existing printed/scanned copies will stop working.');
    if (!confirmed) return;

    try {
      const { revokeIdentifier } = await import('../api/identifierApi');
      await revokeIdentifier(workspaceId, identifier.identifierId);
      setIdentifier(null);
      setError('Label revoked successfully. Close or re-open to acquire a new active label.');
    } catch (err: any) {
      setError(err.message || 'Failed to revoke identifier.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
        <div className="flex justify-between items-center mb-4 print:hidden">
          <h2 className="text-xl font-bold">Print Barcode Label</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-bold text-lg"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {isLoading && <p className="text-gray-600 my-4">Generating barcode label...</p>}
        {error && <p className="text-red-600 my-4">{error}</p>}

        {identifier && (
          <div className="flex flex-col items-center border border-dashed border-gray-400 p-6 rounded bg-white my-4 print:border-none print:shadow-none">
            <span className="text-xs uppercase tracking-widest font-semibold text-gray-500 mb-1">
              WHEREZIT
            </span>
            <span className="text-2xl font-black text-gray-900 mb-3">{boxDisplayId}</span>
            
            <svg ref={svgRef} className="max-w-full h-auto" />

            <span className="font-mono text-xs text-gray-600 mt-2">{identifier.value}</span>
            <span className="text-xs text-gray-400 mt-1">Scan to find this box</span>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
          <button
            onClick={handleRevoke}
            disabled={!identifier}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-600 bg-white rounded-md hover:bg-red-50 disabled:opacity-50"
          >
            Revoke Label
          </button>
          <button
            onClick={() => window.print()}
            disabled={!identifier}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            Print Label
          </button>
        </div>
      </div>
    </div>
  );
};
