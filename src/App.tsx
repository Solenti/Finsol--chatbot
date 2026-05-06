import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  FileText, 
  PieChart, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  FileSpreadsheet,
  FileSearch,
  MessageSquare,
  Loader2,
  X,
  Download,
  Share2
} from 'lucide-react';
import { cn } from './lib/utils';
import { analyzeAccountingFile } from './services/geminiService';
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  HeadingLevel, 
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  BorderStyle,
  AlignmentType
} from 'docx';
import { saveAs } from 'file-saver';

// --- Types ---

interface AnalysisResult {
  id: string;
  timestamp: string;
  summary: string;
  insights: string[];
  metrics: {
    label: string;
    value: string;
    trend: 'up' | 'down' | 'neutral';
    change?: string;
  }[];
  detailedTable?: {
    head: string;
    value: string;
    note?: string;
  }[];
  review: string;
}

// --- Components ---

const SolentiLogo = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <div className="relative w-14 h-14 flex items-center justify-center pt-3">
      {/* Sun on top of S - Match the image rays */}
      <div className="absolute top-0 left-0 w-full h-full flex justify-center">
        <div className="relative w-10 h-10">
          {[...Array(18)].map((_, i) => (
            <div 
              key={i} 
              className="absolute bottom-1/2 left-1/2 w-[1px] h-5 bg-gradient-to-t from-orange-400 to-yellow-300 origin-bottom"
              style={{ 
                transform: `translateX(-50%) rotate(${i * 12 - 100}deg) translateY(-4px)`,
              }}
            />
          ))}
        </div>
      </div>
      {/* Large Bold Blue S - Stylized like the logo */}
      <div className="relative text-blue-900 font-bold text-4xl italic tracking-tighter leading-none select-none z-10 -translate-y-1">
        S
      </div>
    </div>
    <div className="flex flex-col">
      <div className="text-2xl font-bold leading-none tracking-tight flex items-baseline">
        <span className="text-orange-500">Solenti</span>
        <span className="text-blue-900">.AI</span>
      </div>
      <div className="text-[10px] text-blue-900 font-bold uppercase tracking-[0.15em] mt-1 whitespace-nowrap">
        Powering Accounting with AI
      </div>
    </div>
  </div>
);

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-6", className)} {...props}>
    {children}
  </div>
);

const Button = ({ 
  children, 
  onClick, 
  disabled, 
  variant = 'primary',
  className 
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) => {
  const variants = {
    primary: "bg-corporate-blue text-white hover:bg-blue-900 shadow-md",
    secondary: "bg-pastel-blue text-corporate-blue hover:bg-blue-200",
    ghost: "bg-transparent text-gray-500 hover:bg-gray-100"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "px-6 py-3 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2",
        variants[variant],
        className
      )}
    >
      {children}
    </button>
  );
};

export default function App() {
  const [file, setFile] = React.useState<File | null>(null);
  const [prompt, setPrompt] = React.useState("");
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<AnalysisResult | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<AnalysisResult[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = React.useState(false);

  // Load history from localStorage on mount
  React.useEffect(() => {
    const saved = localStorage.getItem('finsol_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  const saveToHistory = (newResult: AnalysisResult) => {
    const updated = [newResult, ...history].slice(0, 10); // Keep last 10
    setHistory(updated);
    localStorage.setItem('finsol_history', JSON.stringify(updated));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const runAnalysis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const analysis = await analyzeAccountingFile(file, prompt || "Analyze this document and provide a summary, key insights, metrics, and a business review.");
      const resultWithMeta: AnalysisResult = {
        ...analysis,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString()
      };
      setResult(resultWithMeta);
      saveToHistory(resultWithMeta);
    } catch (err) {
      console.error(err);
      const errorMessage = (err as any).message || "Failed to analyze the document. Please ensure it's a valid accounting file and try again.";
      setError(errorMessage);
      
      // Fallback to mock data for demo purposes if real analysis fails
      // (Optional: remove this in production)
      /*
      setResult({
        summary: "Demo Analysis: Comprehensive overview of the provided financial statement.",
        insights: ["Insight 1", "Insight 2", "Insight 3", "Insight 4"],
        metrics: [
          { label: "Revenue", value: "$0.00", trend: 'neutral' },
          { label: "Profit", value: "$0.00", trend: 'neutral' },
          { label: "Expenses", value: "$0.00", trend: 'neutral' },
          { label: "Growth", value: "0%", trend: 'neutral' }
        ],
        review: "This is a fallback demo review. Please check your API configuration for real results."
      });
      */
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownload = async () => {
    if (!result) return;
    
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "FINANCIAL ANALYSIS REPORT",
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Date: ${new Date().toLocaleDateString()}`, bold: true }),
            ],
            spacing: { after: 200 },
          }),
          
          new Paragraph({
            text: "Executive Summary",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: result.summary,
            spacing: { after: 400 },
          }),

          new Paragraph({
            text: "Key Financial Data",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          // Key Data Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Category/Item", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Value/Amount", bold: true })] })] }),
                  new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Note/Analysis", bold: true })] })] }),
                ],
              }),
              ...(result.detailedTable || []).map(row => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(row.head)] }),
                  new TableCell({ children: [new Paragraph(row.value)] }),
                  new TableCell({ children: [new Paragraph(row.note || "N/A")] }),
                ],
              })),
              // Fallback to metrics if detailedTable is not present
              ...((!result.detailedTable || result.detailedTable.length === 0) ? result.metrics.map(m => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(m.label)] }),
                  new TableCell({ children: [new Paragraph(m.value)] }),
                  new TableCell({ children: [new Paragraph(m.change || "N/A")] }),
                ],
              })) : []),
            ],
          }),

          new Paragraph({
            text: "Key Metrics",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...result.metrics.map(m => new Paragraph({
            text: `• ${m.label}: ${m.value} (${m.change || 'N/A'})`,
            bullet: { level: 0 },
          })),

          new Paragraph({
            text: "Key Insights",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...result.insights.map(insight => new Paragraph({
            text: insight,
            bullet: { level: 0 },
          })),

          new Paragraph({
            text: "Professional Review",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            text: result.review,
            spacing: { after: 400 },
          }),

          new Paragraph({
            text: "Generated by Finsol AI",
            alignment: AlignmentType.RIGHT,
            spacing: { before: 800 },
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Finsol_Report_${new Date().toISOString().split('T')[0]}.docx`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-pastel-blue rounded-lg flex items-center justify-center">
              <PieChart className="text-corporate-blue w-6 h-6" />
            </div>
            <span className="text-xl font-bold tracking-tight text-corporate-blue">Finsol AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 text-gray-600 relative"
            >
              <FileText className="w-5 h-5" />
              History
              {history.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[10px] flex items-center justify-center rounded-full font-bold">
                  {history.length}
                </span>
              )}
            </Button>
            <Button variant="secondary" className="hidden md:flex">
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* History Drawer Overlay */}
      <AnimatePresence>
        {isHistoryOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsHistoryOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <FileText className="w-6 h-6 text-corporate-blue" />
                  Analysis History
                </h2>
                <button 
                  onClick={() => setIsHistoryOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4">
                {history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <FileSearch className="w-12 h-12 mb-2 opacity-20" />
                    <p>No analysis history yet</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <Card 
                      key={item.id} 
                      className="cursor-pointer hover:border-corporate-blue transition-all group"
                      onClick={() => {
                        setResult(item);
                        setIsHistoryOpen(false);
                        window.scrollTo({ top: 800, behavior: 'smooth' });
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-medium text-gray-400">
                          {new Date(item.timestamp).toLocaleString()}
                        </span>
                        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-corporate-blue transition-colors" />
                      </div>
                      <h4 className="font-bold text-corporate-blue line-clamp-1 mb-1">{item.summary}</h4>
                      <div className="flex gap-2">
                        {item.metrics.slice(0, 2).map((m, idx) => (
                          <span key={idx} className="text-[10px] bg-pastel-blue text-corporate-blue px-2 py-0.5 rounded-full">
                            {m.label}: {m.value}
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))
                )}
              </div>
              
              <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                <SolentiLogo className="scale-75 opacity-50" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-bold mb-6 leading-tight"
          >
            Your AI-Powered <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Accounting Analyst</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-500 max-w-2xl mx-auto"
          >
            Upload any financial document—P&L sheets, invoices, or bank statements—and get instant, professional insights and business reviews.
          </motion.p>
        </section>

        {/* Input Section */}
        <section className="grid gap-8 mb-12">
          <div className="grid md:grid-cols-2 gap-8">
            {/* File Upload */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-pastel-blue" />
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" /> 1. Upload Document
              </h3>
              
              <div 
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 transition-all flex flex-col items-center justify-center text-center gap-4 cursor-pointer",
                  dragActive ? "border-corporate-blue bg-pastel-blue/30" : "border-gray-200 hover:border-pastel-blue hover:bg-gray-50",
                  file ? "bg-pastel-green/10 border-pastel-green" : ""
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input 
                  id="file-upload"
                  type="file" 
                  className="hidden" 
                  onChange={handleFileChange}
                  accept=".pdf,.xlsx,.xls,.csv,.jpg,.png"
                />
                
                {file ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 bg-pastel-green rounded-full flex items-center justify-center">
                      <CheckCircle2 className="text-green-600 w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      className="text-xs text-red-500 hover:underline mt-2 flex items-center gap-1"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-pastel-blue rounded-full flex items-center justify-center">
                      <Upload className="text-corporate-blue w-8 h-8" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">Click or drag & drop</p>
                      <p className="text-sm text-gray-500">Excel, PDF, or Images (Max 10MB)</p>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Prompt Input */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-pastel-purple" />
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" /> 2. What should I do?
              </h3>
              <textarea 
                placeholder="e.g., 'Analyze this P&L sheet and give me a review of the business health' or 'Extract all invoice totals and tax amounts'"
                className="w-full h-[160px] p-4 rounded-xl bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-pastel-purple focus:border-transparent outline-none transition-all resize-none text-gray-700"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {['Analyze P&L', 'Review Health', 'Extract Data'].map(tag => (
                  <button 
                    key={tag}
                    onClick={() => setPrompt(prev => prev ? `${prev} ${tag}` : tag)}
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1 rounded-full transition-colors"
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <div className="flex justify-center flex-col items-center gap-4">
            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {error}
              </motion.div>
            )}
            <Button 
              className="w-full md:w-auto min-w-[240px] h-14 text-lg"
              disabled={!file || isAnalyzing}
              onClick={runAnalysis}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Analyzing Document...
                </>
              ) : (
                <>
                  Analyze Now
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </Button>
          </div>
        </section>

        {/* Results Section */}
        <AnimatePresence>
          {result && (
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="space-y-8"
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="h-px flex-1 bg-gray-200" />
                <h2 className="text-2xl font-bold whitespace-nowrap">Analysis Results</h2>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Summary Card */}
              <Card className="bg-gradient-to-br from-white to-pastel-blue/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center shrink-0">
                    <FileSearch className="text-corporate-blue w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Executive Summary</h3>
                    <p className="text-gray-600 leading-relaxed">{result.summary}</p>
                  </div>
                </div>
              </Card>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {result.metrics.map((metric, i) => (
                  <Card key={i} className="p-4 flex flex-col items-center text-center">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{metric.label}</span>
                    <span className="text-2xl font-bold text-corporate-blue mb-2">{metric.value}</span>
                    <div className={cn(
                      "flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full",
                      metric.trend === 'up' ? "bg-green-100 text-green-600" : 
                      metric.trend === 'down' ? "bg-red-100 text-red-600" : 
                      "bg-gray-100 text-gray-500"
                    )}>
                      {metric.trend === 'up' && <TrendingUp className="w-3 h-3" />}
                      {metric.trend === 'down' && <TrendingUp className="w-3 h-3 rotate-180" />}
                      {metric.change || (metric.trend === 'up' ? "Rising" : metric.trend === 'down' ? "Falling" : "Stable")}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Detailed Table Card */}
                {result.detailedTable && result.detailedTable.length > 0 && (
                  <Card className="md:col-span-2 overflow-hidden border-pastel-blue/30">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-blue-600" /> Key Financial Data Table
                    </h3>
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-corporate-blue uppercase bg-pastel-blue/30">
                          <tr>
                            <th className="px-6 py-3 font-bold">Category / Item</th>
                            <th className="px-6 py-3 font-bold">Value / Amount</th>
                            <th className="px-6 py-3 font-bold">Analysis / Note</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {result.detailedTable.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 font-medium text-gray-900">{row.head}</td>
                              <td className="px-6 py-4 text-corporate-blue font-bold">{row.value}</td>
                              <td className="px-6 py-4 text-gray-500 italic">{row.note || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Insights */}
                <Card>
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500" /> Key Insights
                  </h3>
                  <ul className="space-y-4">
                    {result.insights.map((insight, i) => (
                      <li key={i} className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-pastel-blue flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-corporate-blue">{i + 1}</span>
                        </div>
                        <p className="text-gray-600 text-sm">{insight}</p>
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Business Review */}
                <Card className="bg-corporate-blue text-white">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-white">
                    <AlertCircle className="w-5 h-5 text-pastel-blue" /> Business Review
                  </h3>
                  <div className="bg-white/10 rounded-xl p-6 border border-white/20">
                    <p className="italic leading-relaxed text-blue-50">
                      "{result.review}"
                    </p>
                  </div>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-pastel-blue flex items-center justify-center">
                      <Loader2 className="text-corporate-blue w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Finsol AI Bot</p>
                      <p className="text-xs text-blue-200">Senior Financial Analyst</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="flex justify-center flex-wrap gap-4">
                <Button onClick={handleDownload} variant="secondary">
                  <Download className="w-5 h-5" />
                  Download Report
                </Button>
                <Button variant="ghost">
                  <Share2 className="w-5 h-5" />
                  Share Analysis
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
          <div className="mb-6">
            <SolentiLogo />
          </div>
          <div className="text-2xl font-bold text-corporate-blue mb-4">Finsol AI</div>
          <p className="text-gray-500 max-w-lg mb-8">
            Empowering professionals with instant financial intelligence. 
            Analyze financial documents with precision and grow your business with confidence.
          </p>
          
          <div className="max-w-[400px] w-full p-8 rounded-3xl border border-blue-50 bg-white shadow-xl mb-12 flex flex-col items-center">
             <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-6">Our Technology Partner</div>
             <SolentiLogo />
          </div>

          <div className="pt-8 border-t border-gray-50 w-full text-xs text-gray-400">
            © {new Date().getFullYear()} Finsol AI. All rights reserved. Built for modern professionals.
          </div>
        </div>
      </footer>
    </div>
  );
}
