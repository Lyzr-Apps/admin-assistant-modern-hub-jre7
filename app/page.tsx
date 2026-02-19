'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import { KnowledgeBaseUpload } from '@/components/KnowledgeBaseUpload'
import { useLyzrAgentEvents } from '@/lib/lyzrAgentEvents'
import { AgentActivityPanel } from '@/components/AgentActivityPanel'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  RiSendPlaneFill,
  RiChatSmile2Line,
  RiUserLine,
  RiRobot2Line,
  RiShieldCheckLine,
  RiInformationLine,
  RiCheckboxCircleLine,
  RiCloseCircleLine,
  RiArrowUpLine,
  RiSearchLine,
  RiMailSendLine,
  RiBookOpenLine,
  RiDatabase2Line,
  RiRefreshLine,
  RiAlertLine,
  RiThumbUpLine,
  RiThumbDownLine,
  RiTicket2Line,
  RiTimeLine,
  RiArrowRightSLine,
  RiMenuLine,
  RiCloseLine,
  RiLoader4Line,
  RiPulseLine,
  RiStopCircleLine,
} from 'react-icons/ri'

// ---- Constants ----
const MANAGER_AGENT_ID = '69971296953ca8351f0efd31'
const RAG_ID = '6997125de12ce168202d4ad0'

const AGENTS_INFO = [
  { id: '69971296953ca8351f0efd31', name: 'Support Coordinator Manager', purpose: 'Routes queries, orchestrates sub-agents' },
  { id: '6997127ef908c28cb54245e0', name: 'Knowledge Base Agent', purpose: 'Searches KB for answers, web search fallback' },
  { id: '6997127f87d5b3967580ec38', name: 'Ticket Creator Agent', purpose: 'Creates HubSpot support tickets' },
  { id: '699712802e1ca01aa7c6dfa2', name: 'Email Notifier Agent', purpose: 'Sends Gmail notification emails' },
]

// ---- Interfaces ----
interface AgentResponseData {
  answer?: string
  source?: string
  escalated?: boolean
  ticket_id?: string
  ticket_subject?: string
  email_sent?: boolean
  confidence?: string
  requires_escalation?: boolean
}

interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: string
  metadata?: AgentResponseData
  isError?: boolean
}

interface Ticket {
  id: string
  subject: string
  status: 'Open' | 'Closed'
  priority: 'Low' | 'Medium' | 'High'
  question: string
  createdAt: string
  ticketId: string
  reportedBy?: string
}

type NavTab = 'chat' | 'tickets' | 'kb'

// ---- Sample data ----
const SAMPLE_MESSAGES: ChatMessage[] = [
  {
    id: 's1',
    role: 'user',
    content: 'How do I reset my VPN password?',
    timestamp: new Date(Date.now() - 300000).toISOString(),
  },
  {
    id: 's2',
    role: 'agent',
    content: 'To reset your VPN password, follow these steps:\n\n1. Open the **Company VPN Portal** at vpn.company.com\n2. Click **Forgot Password** on the login page\n3. Enter your employee email address\n4. Check your email for the reset link (usually arrives within 2 minutes)\n5. Create a new password following the policy: minimum 12 characters, 1 uppercase, 1 number, 1 special character\n\nIf you still have issues, I can escalate this to IT support.',
    timestamp: new Date(Date.now() - 290000).toISOString(),
    metadata: {
      answer: 'To reset your VPN password...',
      source: 'knowledge_base',
      escalated: false,
      ticket_id: '',
      ticket_subject: '',
      email_sent: false,
      confidence: 'high',
      requires_escalation: false,
    },
  },
  {
    id: 's3',
    role: 'user',
    content: 'My laptop screen keeps flickering after the latest Windows update.',
    timestamp: new Date(Date.now() - 200000).toISOString(),
  },
  {
    id: 's4',
    role: 'agent',
    content: 'Screen flickering after a Windows update can be caused by incompatible display drivers. Here are some troubleshooting steps:\n\n- **Boot into Safe Mode** and check if the issue persists\n- Try rolling back the display driver via Device Manager\n- Run `sfc /scannow` in an elevated Command Prompt\n\nHowever, since this could indicate a hardware compatibility issue, I recommend escalating this to our hardware support team for further diagnosis.',
    timestamp: new Date(Date.now() - 190000).toISOString(),
    metadata: {
      answer: 'Screen flickering after a Windows update...',
      source: 'combined',
      escalated: false,
      ticket_id: '',
      ticket_subject: '',
      email_sent: false,
      confidence: 'medium',
      requires_escalation: true,
    },
  },
  {
    id: 's5',
    role: 'user',
    content: 'Please escalate the screen flickering issue.',
    timestamp: new Date(Date.now() - 150000).toISOString(),
  },
  {
    id: 's6',
    role: 'agent',
    content: 'I have escalated your issue. A support ticket has been created and the IT hardware team has been notified via email. You should receive a response within 4 business hours.',
    timestamp: new Date(Date.now() - 145000).toISOString(),
    metadata: {
      answer: 'I have escalated your issue...',
      source: 'escalation',
      escalated: true,
      ticket_id: 'TKT-2024-0042',
      ticket_subject: 'Screen flickering after Windows update',
      email_sent: true,
      confidence: 'high',
      requires_escalation: false,
    },
  },
]

const SAMPLE_TICKETS: Ticket[] = [
  {
    id: 'st1',
    subject: 'Screen flickering after Windows update',
    status: 'Open',
    priority: 'High',
    question: 'My laptop screen keeps flickering after the latest Windows update.',
    createdAt: new Date(Date.now() - 145000).toISOString(),
    ticketId: 'TKT-2024-0042',
  },
  {
    id: 'st2',
    subject: 'Unable to access shared drive on new laptop',
    status: 'Open',
    priority: 'Medium',
    question: 'I got a new laptop and cannot access the department shared drive.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    ticketId: 'TKT-2024-0041',
  },
  {
    id: 'st3',
    subject: 'Email sync stopped working on mobile',
    status: 'Closed',
    priority: 'Low',
    question: 'My Outlook app on iPhone stopped syncing emails since yesterday.',
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    ticketId: 'TKT-2024-0039',
  },
]

// ---- Markdown Renderer ----
function formatInline(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    )
  )
}

function renderMarkdown(text: string) {
  if (!text) return null
  return (
    <div className="space-y-1.5">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('### '))
          return (
            <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
              {line.slice(4)}
            </h4>
          )
        if (line.startsWith('## '))
          return (
            <h3 key={i} className="font-semibold text-base mt-3 mb-1">
              {line.slice(3)}
            </h3>
          )
        if (line.startsWith('# '))
          return (
            <h2 key={i} className="font-bold text-lg mt-4 mb-2">
              {line.slice(2)}
            </h2>
          )
        if (line.startsWith('- ') || line.startsWith('* '))
          return (
            <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
              {formatInline(line.slice(2))}
            </li>
          )
        if (/^\d+\.\s/.test(line))
          return (
            <li key={i} className="ml-4 list-decimal text-sm leading-relaxed">
              {formatInline(line.replace(/^\d+\.\s/, ''))}
            </li>
          )
        if (!line.trim()) return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-sm leading-relaxed">
            {formatInline(line)}
          </p>
        )
      })}
    </div>
  )
}

// ---- Confidence Badge ----
function ConfidenceBadge({ confidence }: { confidence: string }) {
  const conf = (confidence || 'medium').toLowerCase()
  if (conf === 'high') {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs gap-1">
        <RiShieldCheckLine className="w-3 h-3" />
        High Confidence
      </Badge>
    )
  }
  if (conf === 'low') {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs gap-1">
        <RiAlertLine className="w-3 h-3" />
        Low Confidence
      </Badge>
    )
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs gap-1">
      <RiInformationLine className="w-3 h-3" />
      Medium Confidence
    </Badge>
  )
}

// ---- Priority Badge ----
function PriorityBadge({ priority }: { priority: string }) {
  const p = (priority || 'medium').toLowerCase()
  if (p === 'high') {
    return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">High</Badge>
  }
  if (p === 'low') {
    return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 text-xs">Low</Badge>
  }
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">Medium</Badge>
}

// ---- Status Badge ----
function StatusBadge({ status }: { status: string }) {
  if (status === 'Open') {
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-xs">Open</Badge>
  }
  return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100 text-xs">Closed</Badge>
}

// ---- Source Badge ----
function SourceBadge({ source }: { source: string }) {
  const s = (source || '').toLowerCase()
  if (s === 'knowledge_base') {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-blue-200 text-blue-600">
        <RiBookOpenLine className="w-3 h-3" />
        Knowledge Base
      </Badge>
    )
  }
  if (s === 'web_search') {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-teal-200 text-teal-600">
        <RiSearchLine className="w-3 h-3" />
        Web Search
      </Badge>
    )
  }
  if (s === 'escalation') {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-orange-200 text-orange-600">
        <RiArrowUpLine className="w-3 h-3" />
        Escalation
      </Badge>
    )
  }
  if (s === 'combined') {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-purple-200 text-purple-600">
        <RiDatabase2Line className="w-3 h-3" />
        Combined
      </Badge>
    )
  }
  return null
}

// ---- Typing Indicator ----
function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 max-w-[85%]">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <RiRobot2Line className="w-4 h-4 text-primary" />
      </div>
      <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white/75 backdrop-blur-md border border-white/20 shadow-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// ---- Escalation Form (Fix 2: includes user name and additional notes) ----
function EscalationForm({
  originalQuestion,
  suggestedSubject,
  onSubmit,
  onCancel,
  isSubmitting,
  defaultUserName,
}: {
  originalQuestion: string
  suggestedSubject: string
  onSubmit: (subject: string, priority: string, userName: string, notes: string) => void
  onCancel: () => void
  isSubmitting: boolean
  defaultUserName?: string
}) {
  const [subject, setSubject] = useState(suggestedSubject)
  const [priority, setPriority] = useState('Medium')
  const [escalationUserName, setEscalationUserName] = useState(defaultUserName || '')
  const [notes, setNotes] = useState('')

  return (
    <div className="mt-3 p-4 rounded-xl bg-amber-50/80 backdrop-blur-sm border border-amber-200/50 space-y-3">
      <div className="flex items-center gap-2 text-amber-700 text-sm font-medium">
        <RiTicket2Line className="w-4 h-4" />
        Create Support Ticket
      </div>
      <div className="space-y-2">
        <div>
          <Label htmlFor="ticket-subject" className="text-xs text-amber-800">Subject</Label>
          <Input
            id="ticket-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Ticket subject..."
            className="mt-1 text-sm bg-white/80 border-amber-200"
          />
        </div>
        <div>
          <Label htmlFor="ticket-user-name" className="text-xs text-amber-800">Your Name *</Label>
          <Input
            id="ticket-user-name"
            value={escalationUserName}
            onChange={(e) => setEscalationUserName(e.target.value)}
            placeholder="Your full name"
            className="mt-1 text-sm bg-white/80 border-amber-200"
            required
          />
        </div>
        <div>
          <Label htmlFor="ticket-priority" className="text-xs text-amber-800">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="mt-1 text-sm bg-white/80 border-amber-200">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="ticket-notes" className="text-xs text-amber-800">Additional Notes</Label>
          <Textarea
            id="ticket-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context or details..."
            className="mt-1 text-sm bg-white/80 border-amber-200 min-h-[60px]"
            rows={2}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onSubmit(subject, priority, escalationUserName, notes)}
          disabled={isSubmitting || !subject.trim() || !escalationUserName.trim()}
          className="text-xs gap-1"
        >
          {isSubmitting ? (
            <>
              <RiLoader4Line className="w-3 h-3 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <RiTicket2Line className="w-3 h-3" />
              Create Ticket
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
          className="text-xs"
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ---- Inline Notification Banner ----
function InlineBanner({
  type,
  message,
  onDismiss,
}: {
  type: 'success' | 'error' | 'info'
  message: string
  onDismiss: () => void
}) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }
  const icons = {
    success: <RiCheckboxCircleLine className="w-4 h-4 flex-shrink-0" />,
    error: <RiCloseCircleLine className="w-4 h-4 flex-shrink-0" />,
    info: <RiInformationLine className="w-4 h-4 flex-shrink-0" />,
  }

  return (
    <div className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm', styles[type])}>
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="p-0.5 hover:opacity-70 transition-opacity">
        <RiCloseLine className="w-4 h-4" />
      </button>
    </div>
  )
}

// ========== MAIN PAGE ==========

export default function Page() {
  // ---- State ----
  const [activeTab, setActiveTab] = useState<NavTab>('chat')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [userId, setUserId] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [sampleDataOn, setSampleDataOn] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
  const [escalatingMessageId, setEscalatingMessageId] = useState<string | null>(null)
  const [isEscalating, setIsEscalating] = useState(false)
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [ticketFilter, setTicketFilter] = useState<'all' | 'Open' | 'Closed'>('all')
  const [ticketSearch, setTicketSearch] = useState('')
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, 'up' | 'down'>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showAgentActivity, setShowAgentActivity] = useState(false)
  const [userName, setUserName] = useState('')
  const [nameSubmitted, setNameSubmitted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Agent activity monitoring
  const agentEvents = useLyzrAgentEvents(sessionId)

  // ---- Init ----
  useEffect(() => {
    const sid = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const uid = `user_${Date.now()}`
    setSessionId(sid)
    setUserId(uid)

    // Load tickets from localStorage
    try {
      const stored = localStorage.getItem('it_support_tickets')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setTickets(parsed)
        }
      }
    } catch {
      // ignore parse errors
    }

    // Load saved user name
    try {
      const savedName = localStorage.getItem('it_support_user_name')
      if (savedName) {
        setUserName(savedName)
        setNameSubmitted(true)
      }
    } catch {
      // ignore
    }
  }, [])

  // ---- Persist tickets ----
  useEffect(() => {
    if (tickets.length > 0) {
      try {
        localStorage.setItem('it_support_tickets', JSON.stringify(tickets))
      } catch {
        // ignore
      }
    }
  }, [tickets])

  // ---- Scroll to bottom ----
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // ---- Sample data toggle ----
  useEffect(() => {
    if (sampleDataOn) {
      setMessages(SAMPLE_MESSAGES)
      setTickets(SAMPLE_TICKETS)
    } else {
      setMessages([])
      // Restore from localStorage on toggle off
      try {
        const stored = localStorage.getItem('it_support_tickets')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed)) {
            setTickets(parsed)
          } else {
            setTickets([])
          }
        } else {
          setTickets([])
        }
      } catch {
        setTickets([])
      }
    }
  }, [sampleDataOn])

  // ---- Safety: reset stuck loading state after 120s ----
  useEffect(() => {
    if (!isLoading) return
    const safetyTimer = setTimeout(() => {
      setIsLoading(false)
      setActiveAgentId(null)
      setIsEscalating(false)
      setBanner({ type: 'error', message: 'Request timed out. Please try again.' })
    }, 120000)
    return () => clearTimeout(safetyTimer)
  }, [isLoading])

  // ---- Textarea auto-resize ----
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`
    }
  }, [])

  // ---- Send message ----
  const handleSendMessage = useCallback(async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsLoading(true)
    setActiveAgentId(MANAGER_AGENT_ID)

    try {
      // Prepend user name to every message so agent always knows who is asking
      const agentMessage = `User: ${userName}. ${message}`
      const result = await callAIAgent(agentMessage, MANAGER_AGENT_ID, {
        session_id: sessionId,
        user_id: userId,
      })

      if (result.success) {
        const data = result.response?.result as AgentResponseData | undefined
        // Robust text extraction: try multiple paths for the answer
        const answer = data?.answer
          || result.response?.message
          || (typeof result.response?.result === 'string' ? result.response.result : null)
          || (result.response?.result?.text)
          || (result.response?.result?.response)
          || (result.response?.result?.message)
          || 'Response received. Please try rephrasing if the answer seems incomplete.'
        const escalated = data?.escalated === true
        const ticketId = data?.ticket_id || ''
        const ticketSubject = data?.ticket_subject || ''
        const emailSent = data?.email_sent === true
        const confidence = data?.confidence || 'medium'
        const requiresEscalation = data?.requires_escalation === true
        const source = data?.source || 'knowledge_base'

        const agentMsg: ChatMessage = {
          id: `msg_${Date.now()}_agent`,
          role: 'agent',
          content: answer,
          timestamp: new Date().toISOString(),
          metadata: {
            answer,
            source,
            escalated,
            ticket_id: ticketId,
            ticket_subject: ticketSubject,
            email_sent: emailSent,
            confidence,
            requires_escalation: requiresEscalation,
          },
        }
        setMessages((prev) => [...prev, agentMsg])

        // If auto-escalated by the manager, save the ticket
        if (escalated && ticketId) {
          const newTicket: Ticket = {
            id: `t_${Date.now()}`,
            subject: ticketSubject || message.slice(0, 80),
            status: 'Open',
            priority: 'Medium',
            question: message,
            createdAt: new Date().toISOString(),
            ticketId: ticketId,
            reportedBy: userName || 'Unknown',
          }
          setTickets((prev) => [newTicket, ...prev])
          setBanner({
            type: 'success',
            message: `Ticket #${ticketId} created${emailSent ? ' and notification sent to admin' : ''}.`,
          })
        }
      } else {
        const fallbackMessage = result.response?.message || result.error || 'Something went wrong. Please try again.'
        const errorMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'agent',
          content: fallbackMessage,
          timestamp: new Date().toISOString(),
          isError: true,
        }
        setMessages((prev) => [...prev, errorMsg])
      }
    } catch {
      const errorMsg: ChatMessage = {
        id: `msg_${Date.now()}_err`,
        role: 'agent',
        content: 'A network error occurred. Please check your connection and try again.',
        timestamp: new Date().toISOString(),
        isError: true,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
    }
  }, [inputValue, isLoading, sessionId, userId, userName])

  // ---- Escalate (Fix 2: includes userName and notes) ----
  const handleEscalate = useCallback(async (originalQuestion: string, subject: string, priority: string, escalateUserName: string, notes: string) => {
    setIsEscalating(true)
    setActiveAgentId(MANAGER_AGENT_ID)

    const escalationMessage = `ESCALATE: Please create a support ticket and send notification email. User Name: ${escalateUserName}. Priority: ${priority}. Subject: ${subject}. Additional Notes: ${notes || 'None'}. Original question: ${originalQuestion}`

    try {
      const result = await callAIAgent(escalationMessage, MANAGER_AGENT_ID, {
        session_id: sessionId,
        user_id: userId,
      })

      if (result.success) {
        const data = result.response?.result as AgentResponseData | undefined
        const answer = data?.answer || result.response?.message || (typeof result.response?.result === 'string' ? result.response.result : null) || 'Your issue has been escalated.'
        const ticketId = data?.ticket_id || `TKT-${Date.now().toString().slice(-6)}`
        const ticketSubject = data?.ticket_subject || subject
        const emailSent = data?.email_sent === true

        const escalationResponse: ChatMessage = {
          id: `msg_${Date.now()}_esc`,
          role: 'agent',
          content: answer,
          timestamp: new Date().toISOString(),
          metadata: {
            answer,
            source: 'escalation',
            escalated: true,
            ticket_id: ticketId,
            ticket_subject: ticketSubject,
            email_sent: emailSent,
            confidence: data?.confidence || 'high',
            requires_escalation: false,
          },
        }
        setMessages((prev) => [...prev, escalationResponse])

        const newTicket: Ticket = {
          id: `t_${Date.now()}`,
          subject: ticketSubject,
          status: 'Open',
          priority: priority as 'Low' | 'Medium' | 'High',
          question: originalQuestion,
          createdAt: new Date().toISOString(),
          ticketId: ticketId,
          reportedBy: escalateUserName || 'Unknown',
        }
        setTickets((prev) => [newTicket, ...prev])
        setBanner({
          type: 'success',
          message: `Ticket #${ticketId} created${emailSent ? ' and notification sent to admin' : ''}.`,
        })
      } else {
        const fallbackMessage = result.response?.message || 'Escalation failed. Please try again.'
        const errorMsg: ChatMessage = {
          id: `msg_${Date.now()}_err`,
          role: 'agent',
          content: fallbackMessage,
          timestamp: new Date().toISOString(),
          isError: true,
        }
        setMessages((prev) => [...prev, errorMsg])
        setBanner({ type: 'error', message: 'Failed to escalate. Please try again.' })
      }
    } catch {
      setBanner({ type: 'error', message: 'Network error during escalation. Please try again.' })
    } finally {
      setIsEscalating(false)
      setEscalatingMessageId(null)
      setActiveAgentId(null)
    }
  }, [sessionId, userId])

  // ---- Key handler ----
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // ---- Feedback handler ----
  const handleFeedback = useCallback((messageId: string, type: 'up' | 'down') => {
    setFeedbackGiven((prev) => ({ ...prev, [messageId]: type }))
  }, [])

  // ---- Filtered tickets ----
  const filteredTickets = Array.isArray(tickets)
    ? tickets.filter((t) => {
        if (ticketFilter !== 'all' && t.status !== ticketFilter) return false
        if (ticketSearch.trim()) {
          const q = ticketSearch.toLowerCase()
          return (
            (t.subject || '').toLowerCase().includes(q) ||
            (t.question || '').toLowerCase().includes(q) ||
            (t.ticketId || '').toLowerCase().includes(q)
          )
        }
        return true
      })
    : []

  // ---- Format date ----
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    } catch {
      return ''
    }
  }

  // ---- Stop handler ----
  const handleStop = useCallback(() => {
    setIsLoading(false)
    setActiveAgentId(null)
    setIsEscalating(false)
  }, [])

  // ---- Render ----
  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: 'linear-gradient(135deg, hsl(210 20% 97%) 0%, hsl(220 25% 95%) 35%, hsl(200 20% 96%) 70%, hsl(230 15% 97%) 100%)' }}>
      {/* ===== SIDEBAR ===== */}
      <aside className={cn('flex flex-col border-r border-border/50 bg-white/60 backdrop-blur-xl transition-all duration-300 flex-shrink-0', sidebarOpen ? 'w-64' : 'w-0 overflow-hidden')}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-border/30">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <RiShieldCheckLine className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-foreground truncate">IT Support Desk</h1>
            <p className="text-xs text-muted-foreground truncate">Assistant</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setActiveTab('chat')}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200', activeTab === 'chat' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground/70 hover:bg-accent hover:text-foreground')}
          >
            <RiChatSmile2Line className="w-4 h-4 flex-shrink-0" />
            Chat
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200', activeTab === 'tickets' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground/70 hover:bg-accent hover:text-foreground')}
          >
            <RiTicket2Line className="w-4 h-4 flex-shrink-0" />
            Ticket History
            {tickets.length > 0 && (
              <span className={cn('ml-auto text-xs px-1.5 py-0.5 rounded-full', activeTab === 'tickets' ? 'bg-white/20' : 'bg-muted text-muted-foreground')}>
                {tickets.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('kb')}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200', activeTab === 'kb' ? 'bg-primary text-primary-foreground shadow-md' : 'text-foreground/70 hover:bg-accent hover:text-foreground')}
          >
            <RiBookOpenLine className="w-4 h-4 flex-shrink-0" />
            Knowledge Base
          </button>

          <Separator className="my-3" />

          <button
            onClick={() => setShowAgentActivity(!showAgentActivity)}
            className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200', showAgentActivity ? 'bg-accent text-foreground' : 'text-foreground/70 hover:bg-accent hover:text-foreground')}
          >
            <RiPulseLine className="w-4 h-4 flex-shrink-0" />
            Agent Activity
          </button>
        </nav>

        {/* Sample Data Toggle */}
        <div className="p-4 border-t border-border/30">
          <div className="flex items-center justify-between">
            <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground cursor-pointer">Sample Data</Label>
            <Switch id="sample-toggle" checked={sampleDataOn} onCheckedChange={setSampleDataOn} />
          </div>
        </div>

        {/* Agents Info */}
        <div className="p-4 border-t border-border/30 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Agents</p>
          {AGENTS_INFO.map((agent) => (
            <div key={agent.id} className="flex items-start gap-2 py-1">
              <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 transition-colors', activeAgentId === agent.id ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30')} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground/80 truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground truncate">{agent.purpose}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/30 bg-white/40 backdrop-blur-md flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-lg hover:bg-accent transition-colors">
            {sidebarOpen ? <RiCloseLine className="w-5 h-5 text-foreground/60" /> : <RiMenuLine className="w-5 h-5 text-foreground/60" />}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              {activeTab === 'chat' && 'IT Support Chat'}
              {activeTab === 'tickets' && 'Ticket History'}
              {activeTab === 'kb' && 'Knowledge Base'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {activeTab === 'chat' && 'Ask anything about IT or your product'}
              {activeTab === 'tickets' && 'View and track escalated issues'}
              {activeTab === 'kb' && 'Manage support documentation'}
            </p>
          </div>
          {activeTab === 'chat' && nameSubmitted && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1 border-border/50 text-foreground/60">
                <RiUserLine className="w-3 h-3" />
                {userName}
              </Badge>
              {isLoading && (
                <Badge variant="outline" className="text-xs gap-1 animate-pulse border-emerald-200 text-emerald-600">
                  <RiLoader4Line className="w-3 h-3 animate-spin" />
                  Processing
                </Badge>
              )}
            </div>
          )}
        </header>

        {/* Banner */}
        {banner && (
          <div className="px-4 pt-3 flex-shrink-0">
            <InlineBanner type={banner.type} message={banner.message} onDismiss={() => setBanner(null)} />
          </div>
        )}

        {/* ===== CHAT TAB ===== */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-3xl mx-auto space-y-5">
                {/* Welcome + Name Prompt */}
                {messages.length === 0 && !isLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                      <RiChatSmile2Line className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground mb-2">
                      Hi! I am your IT & Product Support Assistant.
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                      Ask me anything about IT troubleshooting, software issues, hardware problems, or product questions. I will search the knowledge base for answers or escalate to our support team when needed.
                    </p>

                    {/* Name input - required before chatting */}
                    {!nameSubmitted ? (
                      <div className="mt-8 w-full max-w-sm">
                        <div className="p-5 rounded-2xl bg-white/80 backdrop-blur-md border border-border/30 shadow-sm space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <RiUserLine className="w-4 h-4 text-primary" />
                            Please enter your name to get started
                          </div>
                          <Input
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            placeholder="Your full name"
                            className="bg-white/90 border-border/50 text-sm"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && userName.trim()) {
                                setNameSubmitted(true)
                                try { localStorage.setItem('it_support_user_name', userName.trim()) } catch {}
                                textareaRef.current?.focus()
                              }
                            }}
                          />
                          <Button
                            onClick={() => {
                              if (userName.trim()) {
                                setNameSubmitted(true)
                                try { localStorage.setItem('it_support_user_name', userName.trim()) } catch {}
                                textareaRef.current?.focus()
                              }
                            }}
                            disabled={!userName.trim()}
                            className="w-full gap-2"
                            size="sm"
                          >
                            <RiArrowRightSLine className="w-4 h-4" />
                            Continue
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10">
                          <RiUserLine className="w-3.5 h-3.5 text-primary" />
                          <span className="text-xs font-medium text-foreground/70">Signed in as <span className="text-foreground font-semibold">{userName}</span></span>
                          <button
                            onClick={() => {
                              setNameSubmitted(false)
                              setUserName('')
                              try { localStorage.removeItem('it_support_user_name') } catch {}
                            }}
                            className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            (change)
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-6 justify-center">
                          {[
                            'How do I reset my VPN password?',
                            'My email is not syncing',
                            'Request a new laptop',
                            'Send a test email',
                          ].map((q) => (
                            <button
                              key={q}
                              onClick={() => {
                                if (q === 'Send a test email') {
                                  setInputValue('Send a test email to verify the email integration is working')
                                } else {
                                  setInputValue(q)
                                }
                                textareaRef.current?.focus()
                              }}
                              className={cn('px-3 py-2 text-xs rounded-xl border border-border/50 text-foreground/70 bg-white/60 backdrop-blur-sm hover:bg-white hover:border-border hover:text-foreground transition-all duration-200', q === 'Send a test email' ? 'gap-1.5 flex items-center' : '')}
                            >
                              {q === 'Send a test email' && <RiMailSendLine className="w-3 h-3" />}
                              {q}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Messages */}
                {Array.isArray(messages) &&
                  messages.map((msg) => {
                    if (msg.role === 'user') {
                      return (
                        <div key={msg.id} className="flex justify-end">
                          <div className="flex items-start gap-3 max-w-[85%] flex-row-reverse">
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                              <RiUserLine className="w-4 h-4 text-primary-foreground" />
                            </div>
                            <div className="rounded-2xl rounded-tr-sm px-4 py-3 bg-primary text-primary-foreground shadow-md">
                              <p className="text-sm leading-relaxed">{msg.content}</p>
                              <p className="text-xs opacity-60 mt-1.5 text-right">{formatTime(msg.timestamp)}</p>
                            </div>
                          </div>
                        </div>
                      )
                    }

                    // Agent message
                    const meta = msg.metadata
                    const hasEscalation = meta?.escalated === true
                    const showEscalateButton = meta?.requires_escalation === true || (!hasEscalation && !msg.isError)
                    const isEscalatingThis = escalatingMessageId === msg.id

                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="flex items-start gap-3 max-w-[85%]">
                          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', msg.isError ? 'bg-destructive/10' : 'bg-primary/10')}>
                            {msg.isError ? (
                              <RiAlertLine className="w-4 h-4 text-destructive" />
                            ) : (
                              <RiRobot2Line className="w-4 h-4 text-primary" />
                            )}
                          </div>
                          <div className="space-y-2 flex-1 min-w-0">
                            <div className={cn('rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm', msg.isError ? 'bg-red-50 border border-red-200' : 'bg-white/75 backdrop-blur-md border border-white/20')}>
                              <div className="text-foreground">{renderMarkdown(msg.content)}</div>
                              <p className="text-xs text-muted-foreground mt-2">{formatTime(msg.timestamp)}</p>
                            </div>

                            {/* Metadata badges */}
                            {meta && !msg.isError && (
                              <div className="flex flex-wrap items-center gap-1.5 px-1">
                                <ConfidenceBadge confidence={meta.confidence || 'medium'} />
                                <SourceBadge source={meta.source || ''} />
                                {meta.email_sent && (
                                  <Badge variant="outline" className="text-xs gap-1 border-green-200 text-green-600">
                                    <RiMailSendLine className="w-3 h-3" />
                                    Email Sent
                                  </Badge>
                                )}
                              </div>
                            )}

                            {/* Escalation ticket card */}
                            {hasEscalation && meta?.ticket_id && (
                              <div className="mx-1 p-3 rounded-xl bg-emerald-50/80 border border-emerald-200/50">
                                <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                                  <RiCheckboxCircleLine className="w-4 h-4" />
                                  Ticket #{meta.ticket_id} created
                                  {meta.email_sent ? ' and notification sent to admin' : ''}
                                </div>
                                {meta.ticket_subject && (
                                  <p className="text-xs text-emerald-600 mt-1">Subject: {meta.ticket_subject}</p>
                                )}
                              </div>
                            )}

                            {/* Feedback + Escalate */}
                            {!msg.isError && (
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-xs text-muted-foreground mr-1">Helpful?</span>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'up')}
                                  className={cn('p-1 rounded-md transition-colors', feedbackGiven[msg.id] === 'up' ? 'bg-emerald-100 text-emerald-600' : 'text-muted-foreground/50 hover:text-emerald-600 hover:bg-emerald-50')}
                                >
                                  <RiThumbUpLine className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleFeedback(msg.id, 'down')}
                                  className={cn('p-1 rounded-md transition-colors', feedbackGiven[msg.id] === 'down' ? 'bg-red-100 text-red-600' : 'text-muted-foreground/50 hover:text-red-500 hover:bg-red-50')}
                                >
                                  <RiThumbDownLine className="w-3.5 h-3.5" />
                                </button>

                                {showEscalateButton && !hasEscalation && !isEscalatingThis && (
                                  <>
                                    <Separator orientation="vertical" className="h-4 mx-1" />
                                    <button
                                      onClick={() => setEscalatingMessageId(msg.id)}
                                      className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors', meta?.requires_escalation ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 font-medium' : 'text-muted-foreground/60 hover:text-foreground hover:bg-accent')}
                                    >
                                      <RiArrowUpLine className="w-3 h-3" />
                                      Escalate to Ticket
                                    </button>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Escalation Form */}
                            {isEscalatingThis && (
                              <EscalationForm
                                originalQuestion={messages.find((m) => m.role === 'user' && messages.indexOf(m) < messages.indexOf(msg))?.content || msg.content}
                                suggestedSubject={msg.content.slice(0, 80)}
                                defaultUserName={userName}
                                onSubmit={(subject, priority, escUserName, notes) => {
                                  const origQ = messages.find((m) => m.role === 'user' && messages.indexOf(m) < messages.indexOf(msg))?.content || msg.content
                                  handleEscalate(origQ, subject, priority, escUserName, notes)
                                }}
                                onCancel={() => setEscalatingMessageId(null)}
                                isSubmitting={isEscalating}
                              />
                            )}

                            {/* Retry on error */}
                            {msg.isError && (
                              <div className="px-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs gap-1"
                                  onClick={() => {
                                    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
                                    if (lastUserMsg) {
                                      setInputValue(lastUserMsg.content)
                                      setMessages((prev) => prev.filter((m) => m.id !== msg.id))
                                    }
                                  }}
                                >
                                  <RiRefreshLine className="w-3 h-3" />
                                  Retry
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}

                {/* Loading */}
                {isLoading && <TypingIndicator />}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input bar - flex-shrink-0 ensures it never gets pushed off screen */}
            <div className="px-4 py-3 border-t border-border/30 bg-white/40 backdrop-blur-md flex-shrink-0">
              <div className="max-w-3xl mx-auto flex items-end gap-3">
                <div className="flex-1 relative">
                  <Textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={handleTextareaChange}
                    onKeyDown={handleKeyDown}
                    placeholder={nameSubmitted ? "Ask your IT or product question..." : "Please enter your name above first..."}
                    disabled={!nameSubmitted}
                    className="min-h-[44px] max-h-[160px] resize-none pr-3 bg-white/80 backdrop-blur-sm border-border/50 rounded-xl focus-visible:ring-1 focus-visible:ring-primary/30 text-sm disabled:opacity-60"
                    rows={1}
                  />
                </div>
                {isLoading ? (
                  <Button
                    onClick={handleStop}
                    size="icon"
                    variant="destructive"
                    className="h-11 w-11 rounded-xl flex-shrink-0 shadow-md"
                    title="Stop request"
                  >
                    <RiStopCircleLine className="w-5 h-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || !nameSubmitted}
                    size="icon"
                    className="h-11 w-11 rounded-xl flex-shrink-0 shadow-md"
                  >
                    <RiSendPlaneFill className="w-5 h-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== TICKETS TAB ===== */}
        {activeTab === 'tickets' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Filter bar */}
            <div className="px-4 py-3 border-b border-border/20 bg-white/30 backdrop-blur-sm flex-shrink-0">
              <div className="max-w-3xl mx-auto flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={ticketSearch}
                    onChange={(e) => setTicketSearch(e.target.value)}
                    placeholder="Search tickets..."
                    className="pl-9 bg-white/70 border-border/50 text-sm rounded-xl"
                  />
                </div>
                <div className="flex items-center gap-1 bg-white/70 rounded-xl border border-border/50 p-0.5">
                  {(['all', 'Open', 'Closed'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setTicketFilter(f)}
                      className={cn('px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200', ticketFilter === f ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                    >
                      {f === 'all' ? 'All' : f}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-3xl mx-auto space-y-3">
                {filteredTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <RiTicket2Line className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground/80 mb-1">
                      {ticketSearch || ticketFilter !== 'all' ? 'No matching tickets' : 'No tickets yet'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {ticketSearch || ticketFilter !== 'all'
                        ? 'Try adjusting your search or filter criteria.'
                        : 'All questions answered! When issues need further attention, tickets will appear here.'}
                    </p>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <Card key={ticket.id} className="bg-white/75 backdrop-blur-md border-white/20 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">{ticket.ticketId}</span>
                              <StatusBadge status={ticket.status} />
                              <PriorityBadge priority={ticket.priority} />
                            </div>
                            <h4 className="text-sm font-semibold text-foreground mb-1 line-clamp-1">{ticket.subject}</h4>
                            {ticket.reportedBy && (
                              <div className="flex items-center gap-1.5 mb-1">
                                <RiUserLine className="w-3 h-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground font-medium">Reported by: {ticket.reportedBy}</span>
                              </div>
                            )}
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{ticket.question}</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-shrink-0 mt-1">
                            <RiTimeLine className="w-3.5 h-3.5" />
                            {formatDate(ticket.createdAt)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== KNOWLEDGE BASE TAB ===== */}
        {activeTab === 'kb' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="max-w-3xl mx-auto space-y-6">
                <Card className="bg-white/75 backdrop-blur-md border-white/20 shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                      <RiBookOpenLine className="w-5 h-5 text-primary" />
                      Knowledge Base Documents
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload PDF, DOCX, or TXT files to train the support knowledge base. The AI assistant will use these documents to answer questions.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <KnowledgeBaseUpload ragId={RAG_ID} />
                  </CardContent>
                </Card>

                <Card className="bg-white/75 backdrop-blur-md border-white/20 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <RiInformationLine className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">How it works</h4>
                        <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
                          <li className="flex items-start gap-2">
                            <RiArrowRightSLine className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                            Upload your IT documentation, FAQs, and product manuals
                          </li>
                          <li className="flex items-start gap-2">
                            <RiArrowRightSLine className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                            Documents are processed and indexed for semantic search
                          </li>
                          <li className="flex items-start gap-2">
                            <RiArrowRightSLine className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                            The AI uses these documents to answer user questions accurately
                          </li>
                          <li className="flex items-start gap-2">
                            <RiArrowRightSLine className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-blue-400" />
                            Questions not found in the KB are automatically escalated
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ===== AGENT ACTIVITY PANEL ===== */}
      {showAgentActivity && (
        <div className="w-80 border-l border-border/30 bg-white/50 backdrop-blur-md flex-shrink-0 overflow-hidden">
          <AgentActivityPanel
            isConnected={agentEvents.isConnected}
            events={agentEvents.events}
            thinkingEvents={agentEvents.thinkingEvents}
            lastThinkingMessage={agentEvents.lastThinkingMessage}
            activeAgentId={agentEvents.activeAgentId}
            activeAgentName={agentEvents.activeAgentName}
            isProcessing={agentEvents.isProcessing}
          />
        </div>
      )}
    </div>
  )
}
