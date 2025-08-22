import { X, Download, Maximize2, Share2 } from 'lucide-react';

interface ArtifactViewerProps {
  artifactId: string;
  onClose: () => void;
}

export default function ArtifactViewer({ artifactId, onClose }: ArtifactViewerProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Company KPIs - MTD
        </h2>
        
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Share2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Download className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Maximize2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Placeholder dashboard */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Revenue</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">$1.25M</p>
            <p className="mt-1 text-sm text-green-600">+12% from last month</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Customers</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">156</p>
            <p className="mt-1 text-sm text-green-600">+8 new this month</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">NPS Score</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">72</p>
            <p className="mt-1 text-sm text-gray-600">Industry avg: 50</p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Profit Margin</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">21.6%</p>
            <p className="mt-1 text-sm text-red-600">-2.1% from last month</p>
          </div>
        </div>

        {/* Chart placeholder */}
        <div className="mt-6 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 h-64 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">Revenue Trend Chart</p>
        </div>
      </div>
    </div>
  );
}