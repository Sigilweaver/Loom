import { useState, useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface DataSource {
  id: string;
  name: string;
  category: 'file' | 'database';
  description: string;
  enabled: boolean;
}

const DATA_SOURCES: DataSource[] = [
  // File formats
  {
    id: 'csv',
    name: 'CSV',
    category: 'file',
    description: 'Delimited text files (CSV, TSV, TAB, TXT)',
    enabled: true
  },
  {
    id: 'excel',
    name: 'Excel',
    category: 'file',
    description: 'Microsoft Excel spreadsheet',
    enabled: false
  },
  {
    id: 'parquet',
    name: 'Parquet',
    category: 'file',
    description: 'Apache Parquet columnar storage',
    enabled: false
  },
  {
    id: 'json',
    name: 'JSON',
    category: 'file',
    description: 'JavaScript Object Notation files',
    enabled: false
  },
  
  // Databases
  {
    id: 'sqlite',
    name: 'SQLite',
    category: 'database',
    description: 'Lightweight SQL database',
    enabled: false
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'database',
    description: 'Advanced open source database',
    enabled: false
  },
  {
    id: 'mysql',
    name: 'MySQL',
    category: 'database',
    description: 'Popular open source database',
    enabled: false
  },
  {
    id: 'mariadb',
    name: 'MariaDB',
    category: 'database',
    description: 'MySQL-compatible database',
    enabled: false
  },
  {
    id: 'oracle',
    name: 'Oracle Database',
    category: 'database',
    description: 'Enterprise database system',
    enabled: false
  },
  {
    id: 'sqlserver',
    name: 'SQL Server',
    category: 'database',
    description: 'Microsoft SQL Server database',
    enabled: false
  }
];

interface DataSourceSelectorProps {
  onSelect: (dataSource: DataSource) => void;
  selectedId?: string | undefined;
}

// Get icon URL based on theme and data source
const getIconUrl = (dataSourceId: string, currentTheme: string): string => {
  // Determine icon color based on theme with much better contrast
  let color: string;
  
  switch (currentTheme) {
    case 'sigilweaver':
      // Much lighter for sigilweaver dark theme
      color = 'white';
      break;
    case 'dark':
      // Much lighter for dark theme
      color = 'white';
      break;
    case 'light':
      // Much darker for light theme
      color = '333333';  // Very dark gray, almost black
      break;
    case 'highContrast':
      // High contrast uses white for maximum contrast
      color = 'white';
      break;
    default:
      // Default fallback to dark
      color = '333333';
  }
  
  // Simple Icons mapping
  const simpleIconsMap: Record<string, string> = {
    csv: 'files',
    excel: 'microsoftexcel',
    parquet: 'apacheparquet',
    json: 'json',
    sqlite: 'sqlite',
    postgresql: 'postgresql',
    mysql: 'mysql',
    mariadb: 'mariadb',
    sqlserver: 'microsoftsqlserver'
  };
  
  // For Oracle, use devicons since simple-icons removed it due to legal issues
  if (dataSourceId === 'oracle') {
    return `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/oracle/oracle-original.svg`;
  }
  
  // Use simple-icons for everything else
  const iconName = simpleIconsMap[dataSourceId];
  if (iconName) {
    return `https://cdn.simpleicons.org/${iconName}/${color}`;
  }
  
  // Fallback
  return `https://cdn.simpleicons.org/files/${color}`;
};

export const DataSourceSelector: React.FC<DataSourceSelectorProps> = ({ 
  onSelect, 
  selectedId 
}) => {
  const { currentTheme } = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'file' | 'database'>('all');

  // Filter data sources based on search and category
  const filteredSources = useMemo(() => {
    let sources = DATA_SOURCES;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      sources = sources.filter(ds => 
        ds.name.toLowerCase().includes(term) ||
        ds.description.toLowerCase().includes(term)
      );
    }
    
    if (selectedCategory !== 'all') {
      sources = sources.filter(ds => ds.category === selectedCategory);
    }
    
    return sources;
  }, [searchTerm, selectedCategory]);

  // Group sources by category
  const fileFormats = filteredSources.filter(ds => ds.category === 'file');
  const databases = filteredSources.filter(ds => ds.category === 'database');

  const DataSourceCard: React.FC<{ dataSource: DataSource }> = ({ dataSource }) => {
    const isSelected = selectedId === dataSource.id;
    
    return (
      <button
        onClick={() => dataSource.enabled && onSelect(dataSource)}
        disabled={!dataSource.enabled}
        className={`
          relative w-full p-4 border-2 rounded-lg transition-all duration-200 text-left
          ${dataSource.enabled 
            ? 'cursor-pointer hover:shadow-md' 
            : 'cursor-not-allowed opacity-60'
          }
          ${isSelected 
            ? 'border-theme-border-focus bg-theme-interactive-accent text-white shadow-md' 
            : 'border-theme-border-primary bg-theme-surface-panel hover:border-theme-border-focus'
          }
        `}
      >
        {/* Coming Soon Badge */}
        {!dataSource.enabled && (
          <div className="absolute top-2 right-2 px-2 py-1 text-xs font-medium bg-theme-surface-elevated text-theme-text-tertiary border border-theme-border-primary rounded-md">
            Coming Soon
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
            <img 
              src={getIconUrl(dataSource.id, currentTheme.id)}
              alt={`${dataSource.name} icon`}
              className="w-6 h-6"
              onError={(e) => {
                // Fallback to text if icon fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLDivElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
            <div 
              className="w-6 h-6 rounded bg-theme-text-tertiary items-center justify-center text-white text-xs font-bold hidden"
            >
              {dataSource.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className={`font-medium ${isSelected ? 'text-white' : 'text-theme-text-primary'}`}>
              {dataSource.name}
            </div>
            <div className={`text-sm ${isSelected ? 'text-white opacity-90' : 'text-theme-text-secondary'}`}>
              {dataSource.description}
            </div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Search Bar and Filters - Fixed at top */}
      <div className="flex-shrink-0 space-y-3 p-4 border-b border-theme-border-primary bg-theme-surface-panel">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-theme-text-tertiary text-sm">🔍</span>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search data sources..."
            className="w-full pl-10 pr-4 py-2 border border-theme-border-primary rounded-lg text-sm
                       bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                       focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors border ${
              selectedCategory === 'all'
                ? 'bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary shadow-sm'
                : 'bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary border-theme-border-primary'
            }`}
          >
            All Sources
          </button>
          
          <button
            onClick={() => setSelectedCategory('file')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 border ${
              selectedCategory === 'file'
                ? 'bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary shadow-sm'
                : 'bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary border-theme-border-primary'
            }`}
          >
            <span>📁</span>
            Files
          </button>
          
          <button
            onClick={() => setSelectedCategory('database')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 border ${
              selectedCategory === 'database'
                ? 'bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary shadow-sm'
                : 'bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary border-theme-border-primary'
            }`}
          >
            <span>🗄️</span>
            Databases
          </button>
        </div>
      </div>

      {/* Scrollable Data Sources */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <div className="space-y-4">
        {selectedCategory !== 'database' && fileFormats.length > 0 && (
          <div>
            {selectedCategory === 'all' && (
              <h4 className="text-sm font-medium text-theme-text-primary mb-2 flex items-center gap-2">
                <span>📁</span>
                File Formats
              </h4>
            )}
            <div className="space-y-2">
              {fileFormats.map(dataSource => (
                <DataSourceCard key={dataSource.id} dataSource={dataSource} />
              ))}
            </div>
          </div>
        )}

        {selectedCategory !== 'file' && databases.length > 0 && (
          <div>
            {selectedCategory === 'all' && (
              <h4 className="text-sm font-medium text-theme-text-primary mb-2 flex items-center gap-2">
                <span>🗄️</span>
                Databases
              </h4>
            )}
            <div className="space-y-2">
              {databases.map(dataSource => (
                <DataSourceCard key={dataSource.id} dataSource={dataSource} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* No Results */}
      {filteredSources.length === 0 && (
        <div className="text-center py-8 text-theme-text-tertiary">
          <div className="text-2xl mb-2">🔍</div>
          <p className="text-sm">No data sources found</p>
          <p className="text-xs mt-1">Try adjusting your search or category filter</p>
        </div>
      )}
      </div>
    </div>
  );
};
