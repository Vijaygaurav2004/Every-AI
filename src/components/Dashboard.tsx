import React, { useState } from 'react'
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ScrollArea } from "./ui/scroll-area"
import ToolInterface from './ToolInterface'
import { aiTools } from '../data/aiTools'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuthState } from 'react-firebase-hooks/auth'  // Add this import
import { 
  Search, 
  Home, 
  FolderOpen, 
  Users, 
  Plus, 
  Play, 
  User,
  ChevronDown,
  MessageSquare,
  Image as ImageIcon,
  Code,
  Music,
  Video,
  FileText,
  MoreHorizontal,
  LogOut
} from 'lucide-react'

// ... (rest of the imports and constants)

function Dashboard() {
  const [user] = useAuthState(auth);  // Add this line
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTool, setActiveTool] = useState<string | null>(null)

  const filteredTools = aiTools.filter((tool: any) => 
    (selectedCategory === "All" || tool.category === selectedCategory) &&
    tool.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const openToolInterface = (toolName: string) => {
    setActiveTool(toolName)
  }

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (activeTool) {
    return <ToolInterface toolName={activeTool} onBack={() => setActiveTool(null)} userId={user?.uid || ''} />
  }

  return (
    <div className="flex h-screen w-full bg-gray-900 text-white overflow-hidden">
      {/* Sidebar */}
      <div className="w-16 flex-shrink-0 bg-gray-800 flex flex-col items-center py-4 space-y-4">
        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-2xl font-bold">
          AI
        </div>
        <Button variant="ghost" size="icon"><Search className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><Home className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><FolderOpen className="h-5 w-5" /></Button>
        <Button variant="ghost" size="icon"><Users className="h-5 w-5" /></Button>
        <div className="flex-grow"></div>
        <Button variant="ghost" size="icon" onClick={handleLogout}><LogOut className="h-5 w-5" /></Button>
      </div>

      {/* Main Content */}
      {/* ... (rest of the Dashboard component remains the same) */}
    </div>
  )
}

export default Dashboard
