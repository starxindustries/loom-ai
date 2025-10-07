"use client"
import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  ConnectionLineType,
  Panel,
  useNodesState,
  useEdgesState,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Brain, Zap, Clock, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

// Mock Memory type
interface Memory {
  id: string;
  keyword_hints?: string[];
  created_at: string;
  content_length?: number;
  is_encrypted?: boolean;
}

interface MemoryFlowGlobalProps {
  memories: Memory[];
  centralMemoryId?: string;
}

// Custom Memory Node Component
function MemoryNode({ data }: { data: any }) {
  const { memory, isCentral, category } = data;
  
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch {
      return 'Unknown';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      personal: 'bg-blue-500',
      work: 'bg-green-500',
      family: 'bg-purple-500',
      preference: 'bg-orange-500',
      travel: 'bg-pink-500',
      food: 'bg-yellow-500',
      health: 'bg-red-500',
      technology: 'bg-cyan-500',
      education: 'bg-indigo-500',
      finance: 'bg-emerald-500',
      default: 'bg-gray-500'
    };
    return colors[category as keyof typeof colors] || colors.default;
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: 'hsl(var(--primary))', width: 8, height: 8 }}
      />
      <Card className={`min-w-[200px] max-w-[280px] ${isCentral ? 'ring-2 ring-primary shadow-lg' : 'shadow-md'} transition-all duration-200 hover:shadow-xl`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-full ${isCentral ? 'bg-primary' : 'bg-muted'} flex-shrink-0`}>
              {isCentral ? (
                <Brain className={`h-4 w-4 ${isCentral ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              ) : (
                <Zap className={`h-4 w-4 ${isCentral ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="secondary" 
                  className={`text-xs ${getCategoryColor(category)} text-white`}
                >
                  {category || 'general'}
                </Badge>
                {memory.is_encrypted && (
                  <Badge variant="outline" className="text-xs">
                    🔒
                  </Badge>
                )}
              </div>
              
              {/* Keywords */}
              <div className="flex flex-wrap gap-1 mb-2">
                {memory.keyword_hints?.slice(0, 3).map((keyword: string, index: number) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {keyword}
                  </Badge>
                ))}
                {(memory.keyword_hints?.length || 0) > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{(memory.keyword_hints?.length || 0) - 3}
                  </Badge>
                )}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(memory.created_at)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>{memory.content_length || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Custom Central Node Component
function CentralNode({ data }: { data: any }) {
  return (
    <div className="relative">
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'hsl(var(--primary))', width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Top}
        style={{ background: 'hsl(var(--primary))', width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: 'hsl(var(--primary))', width: 10, height: 10 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        style={{ background: 'hsl(var(--primary))', width: 10, height: 10 }}
      />
      <div className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground border-4 border-primary rounded-2xl shadow-xl">
        <Brain className="h-7 w-7" />
        <span className="text-xl font-bold">Memory</span>
      </div>
    </div>
  );
}

// Custom Category Node Component
function CategoryNode({ data }: { data: any }) {
  const { category, count } = data;
  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'hsl(var(--secondary))', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'hsl(var(--secondary))', width: 8, height: 8 }}
      />
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground border-[3px] border-border rounded-xl shadow-lg">
        <Zap className="h-5 w-5" />
        <span className="font-semibold capitalize">{category}</span>
        <Badge variant="secondary" className="text-xs ml-1 bg-primary/20">
          {count}
        </Badge>
      </div>
    </div>
  );
}

const nodeTypes = {
  memoryNode: MemoryNode,
  centralNode: CentralNode,
  categoryNode: CategoryNode,
};

export default function MemoryFlowGlobal({ memories }: MemoryFlowGlobalProps) {

  // Create nodes and edges with hierarchical structure
  const { initialNodes, initialEdges } = useMemo(() => {
    if (memories.length === 0) return { initialNodes: [], initialEdges: [] };

    // Helper function to extract categories from keywords dynamically
    const extractCategories = (memory: Memory): string[] => {
      const keywords = memory.keyword_hints || [];
      const categories: string[] = [];
      
      // Common category keywords to look for
      const categoryMappings = {
        'personal': ['personal', 'me', 'myself', 'my', 'name', 'age', 'birthday', 'height'],
        'family': ['family', 'brother', 'sister', 'mother', 'father', 'parent', 'child', 'wife', 'husband'],
        'work': ['work', 'job', 'career', 'office', 'company', 'project', 'meeting', 'colleague'],
        'preference': ['favorite', 'like', 'love', 'prefer', 'enjoy', 'hobby', 'interest'],
        'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'city', 'country'],
        'food': ['food', 'eat', 'restaurant', 'cooking', 'recipe', 'meal'],
        'health': ['health', 'medical', 'doctor', 'medicine', 'exercise', 'fitness'],
        'technology': ['tech', 'computer', 'software', 'app', 'coding', 'programming'],
        'education': ['school', 'university', 'study', 'learn', 'course', 'degree'],
        'finance': ['money', 'budget', 'bank', 'investment', 'salary', 'expense']
      };

      // Check each keyword against category mappings
      keywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        Object.entries(categoryMappings).forEach(([category, categoryKeywords]) => {
          if (categoryKeywords.some(catKeyword => lowerKeyword.includes(catKeyword))) {
            if (!categories.includes(category)) {
              categories.push(category);
            }
          }
        });
      });

      // If no categories found, assign to 'general'
      return categories.length > 0 ? categories : ['general'];
    };

    // Group memories by categories - assign each memory to only ONE primary category
    const memoriesByCategory: { [category: string]: Memory[] } = {};
    const allCategories = new Set<string>();

    memories.forEach(memory => {
      const categories = extractCategories(memory);
      // Only use the first category to avoid duplicates
      const primaryCategory = categories[0];
      
      allCategories.add(primaryCategory);
      if (!memoriesByCategory[primaryCategory]) {
        memoriesByCategory[primaryCategory] = [];
      }
      memoriesByCategory[primaryCategory].push(memory);
    });

    const categoryList = Array.from(allCategories);

    // Create central "Memory" node - positioned at the center
    const centralNode: Node = {
      id: 'central-memory',
      type: 'centralNode',
      position: { x: 0, y: 0 },
      draggable: false,
      data: {},
    };

    // Create category nodes arranged in a circle around central node
    const categoryRadius = 320;
    const categoryAngleStep = (2 * Math.PI) / categoryList.length;
    
    const categoryNodes: Node[] = categoryList.map((category, index) => {
      const angle = index * categoryAngleStep - Math.PI / 2; // Start from top
      const x = categoryRadius * Math.cos(angle);
      const y = categoryRadius * Math.sin(angle);

      return {
        id: `category-${category}`,
        type: 'categoryNode',
        position: { x: x - 90, y: y - 30 },
        draggable: true,
        data: { 
          category,
          count: memoriesByCategory[category]?.length || 0
        },
      };
    });

    // Create memory nodes positioned around their respective categories
    const memoryNodes: Node[] = [];
    categoryList.forEach((category, categoryIndex) => {
      const categoryMemories = memoriesByCategory[category] || [];
      const categoryAngle = categoryIndex * categoryAngleStep - Math.PI / 2;
      const categoryCenterX = categoryRadius * Math.cos(categoryAngle);
      const categoryCenterY = categoryRadius * Math.sin(categoryAngle);

      // Position memories around their category
      const memoryRadius = 240;
      const memoriesCount = categoryMemories.length;
      
      categoryMemories.forEach((memory, memoryIndex) => {
        // Spread memories in an arc around the category
        const spreadFactor = memoriesCount > 1 ? (memoryIndex - (memoriesCount - 1) / 2) : 0;
        const spreadAngle = categoryAngle + spreadFactor * (Math.PI / 6) / Math.max(memoriesCount, 1);
        const x = categoryCenterX + memoryRadius * Math.cos(spreadAngle);
        const y = categoryCenterY + memoryRadius * Math.sin(spreadAngle);

        memoryNodes.push({
          id: memory.id,
          type: 'memoryNode',
          position: { x: x - 100, y: y - 50 },
          draggable: true,
          data: { 
            memory, 
            isCentral: false,
            category
          },
        });
      });
    });

    const allNodes = [centralNode, ...categoryNodes, ...memoryNodes];

    // Create edges with proper configuration
    const edges: Edge[] = [];

    // Connect central node to category nodes with visible styling
    categoryList.forEach((category, index) => {
      edges.push({
        id: `edge-central-to-${category}`,
        source: 'central-memory',
        target: `category-${category}`,
        type: 'smoothstep',
        animated: true,
        style: { 
          stroke: 'hsl(var(--primary))',
          strokeWidth: 4,
          strokeOpacity: 0.8,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 25,
          height: 25,
          color: 'hsl(var(--primary))',
        },
        deletable: false,
        focusable: true,
        selectable: false,
      });
    });

    // Connect category nodes to their memories with visible styling
    categoryList.forEach((category, categoryIndex) => {
      const categoryMemories = memoriesByCategory[category] || [];
      
      categoryMemories.forEach((memory, memoryIndex) => {
        edges.push({
          id: `edge-${category}-to-${memory.id}`,
          source: `category-${category}`,
          target: memory.id,
          type: 'smoothstep',
          animated: false,
          style: { 
            stroke: 'hsl(var(--muted-foreground))',
            strokeWidth: 3,
            strokeOpacity: 0.7,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 18,
            height: 18,
            color: 'hsl(var(--muted-foreground))',
          },
          deletable: false,
          focusable: true,
          selectable: false,
        });
      });
    });

    console.log('=== Memory Flow Debug ===');
    console.log('Total memories:', memories.length);
    console.log('Categories found:', categoryList);
    console.log('Memories by category:', memoriesByCategory);
    console.log('Created nodes:', allNodes.length);
    console.log('Node IDs:', allNodes.map(n => n.id));
    console.log('Created edges:', edges.length);
    console.log('Edge connections:', edges.map(e => `${e.source} -> ${e.target}`));
    console.log('Edge details:', edges.map(e => ({ id: e.id, source: e.source, target: e.target, type: e.type, style: e.style })));
    console.log('========================');

    return { initialNodes: allNodes, initialEdges: edges };
  }, [memories]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Calculate categories count for display
  const categoriesCount = useMemo(() => {
    const allCategories = new Set<string>();
    memories.forEach(memory => {
      const keywords = memory.keyword_hints || [];
      const categories: string[] = [];
      const categoryMappings = {
        'personal': ['personal', 'me', 'myself', 'my', 'name', 'age', 'birthday', 'height'],
        'family': ['family', 'brother', 'sister', 'mother', 'father', 'parent', 'child', 'wife', 'husband'],
        'work': ['work', 'job', 'career', 'office', 'company', 'project', 'meeting', 'colleague'],
        'preference': ['favorite', 'like', 'love', 'prefer', 'enjoy', 'hobby', 'interest'],
        'travel': ['travel', 'trip', 'vacation', 'flight', 'hotel', 'city', 'country'],
        'food': ['food', 'eat', 'restaurant', 'cooking', 'recipe', 'meal'],
        'health': ['health', 'medical', 'doctor', 'medicine', 'exercise', 'fitness'],
        'technology': ['tech', 'computer', 'software', 'app', 'coding', 'programming'],
        'education': ['school', 'university', 'study', 'learn', 'course', 'degree'],
        'finance': ['money', 'budget', 'bank', 'investment', 'salary', 'expense']
      };
      keywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        Object.entries(categoryMappings).forEach(([category, categoryKeywords]) => {
          if (categoryKeywords.some(catKeyword => lowerKeyword.includes(catKeyword))) {
            if (!categories.includes(category)) {
              categories.push(category);
            }
          }
        });
      });
      const finalCategories = categories.length > 0 ? categories : ['general'];
      finalCategories.forEach(cat => allCategories.add(cat));
    });
    return allCategories.size;
  }, [memories]);

  if (memories.length === 0) {
    return (
      <div className="h-[600px] flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No memories to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[700px] w-full border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{
          padding: 0.2,
          includeHiddenNodes: false,
          minZoom: 0.1,
          maxZoom: 1.2,
        }}
        attributionPosition="bottom-left"
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
          style: { 
            strokeWidth: 3,
            stroke: '#6366f1',
            strokeOpacity: 0.8
          },
        }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
      >
        <Background 
          variant={BackgroundVariant.Dots} 
          gap={20} 
          size={1} 
          color="hsl(var(--muted-foreground))" 
          style={{ opacity: 0.3 }}
        />
        <Controls 
          showZoom={true}
          showFitView={true}
          showInteractive={true}
          position="bottom-right"
        />
        <MiniMap 
          nodeStrokeColor="hsl(var(--border))"
          nodeColor="hsl(var(--muted))"
          nodeBorderRadius={8}
          maskColor="rgba(0, 0, 0, 0.1)"
          position="top-right"
          style={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
          }}
        />
        <Panel position="top-left" className="bg-background/95 backdrop-blur-sm p-4 rounded-lg border shadow-lg">
          <div className="text-base font-semibold mb-1.5">Hierarchical Memory Network</div>
          <div className="text-sm text-muted-foreground">
            {memories.length} memories • {categoriesCount} categories
          </div>
          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              <span>Central Memory Hub</span>
            </div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded bg-secondary border-2 border-border"></div>
              <span>Category Nodes</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded border-2 border-muted"></div>
              <span>Individual Memories</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}