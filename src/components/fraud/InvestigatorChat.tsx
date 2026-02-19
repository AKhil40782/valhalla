'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrainCircuit, Sparkles, MessageSquare, Send, Loader2, Zap } from 'lucide-react';
import { Button } from "@/components/ui/button";
import React from 'react';

interface ChatProps {
    explanation: string;
}

// Suggested questions for quick access
const SUGGESTED_QUESTIONS = [
    "Analyze the money mule network",
    "Explain the structuring pattern",
    "Analyze deep forensic packets",
    "Show velocity attack details",
    "Generate investigation report"
];

export function InvestigatorChat({ explanation }: ChatProps) {
    const [input, setInput] = React.useState('');
    const [messages, setMessages] = React.useState<{ role: 'user' | 'assistant', content: string, timestamp?: string }[]>([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [showSuggestions, setShowSuggestions] = React.useState(true);
    const [isMounted, setIsMounted] = React.useState(false);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    const hasSetInitialMessage = React.useRef(false);

    React.useEffect(() => {
        setIsMounted(true);
        // Only set the initial message once to prevent chat resets on refresh
        if (!hasSetInitialMessage.current && explanation) {
            setMessages([{ role: 'assistant', content: explanation, timestamp: new Date().toLocaleTimeString() }]);
            hasSetInitialMessage.current = true;
        }
    }, [explanation]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    React.useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e?: React.FormEvent, quickMessage?: string) => {
        if (e) e.preventDefault();
        const messageToSend = quickMessage || input;
        if (!messageToSend.trim() || isLoading) return;

        const userMessage = messageToSend;
        setInput('');
        setShowSuggestions(false);
        setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date().toLocaleTimeString() }]);
        setIsLoading(true);

        try {
            const { chatWithInvestigator } = await import('@/app/chat-action');
            const result = await chatWithInvestigator(userMessage);

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: result.response,
                timestamp: new Date().toLocaleTimeString()
            }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: "⚠️ Error connecting to Sherlock AI. Please try again.",
                timestamp: new Date().toLocaleTimeString()
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const formatContent = (content: string) => {
        return content
            .replace(/\n/g, '<br/>')
            .replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-400">$1</strong>')
            .replace(/`{3}([\s\S]*?)`{3}/g, '<pre class="bg-slate-800 p-2 rounded my-2 overflow-x-auto text-xs">$1</pre>')
            .replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1 rounded text-cyan-300">$1</code>')
            .replace(/##\s(.+?)(<br|$)/g, '<h3 class="text-lg font-bold text-purple-400 mt-3 mb-2">$1</h3>')
            .replace(/•\s/g, '<span class="text-cyan-500 mr-1">•</span>')
            .replace(/🔴|🟠|🟡|🟢|⚠️|🚨|🔒|📋|🔍|📞|🌐|📧|⚖️|⛔|💳|🤖|📊|📱|💸|🔑|🛡️|🏷️/g, '<span class="text-lg">$&</span>');
    };

    return (
        <Card className="h-full border-slate-800 bg-slate-950/50 flex flex-col min-h-[400px]">
            <CardHeader className="pb-3 border-b border-slate-800/50">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-lg">
                        <BrainCircuit className="w-5 h-5 text-purple-400" />
                        <span>AI Investigator</span>
                        <span className="text-xs font-normal text-slate-500 ml-2">"Sherlock"</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Online
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {msg.role === 'assistant' ? (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-purple-500/30 flex items-center justify-center shrink-0">
                                <Sparkles className="w-4 h-4 text-purple-400" />
                            </div>
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border border-cyan-500/30 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-4 h-4 text-cyan-400" />
                            </div>
                        )}
                        <div className={`space-y-1 max-w-[85%]`}>
                            <div className={`border rounded-lg p-3 text-sm leading-relaxed shadow-lg ${msg.role === 'assistant'
                                ? 'bg-slate-900/80 border-slate-700 text-slate-300'
                                : 'bg-cyan-950/30 border-cyan-900/50 text-cyan-50'
                                }`}>
                                <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
                            </div>
                            <div className="text-[10px] text-slate-600 px-1">
                                {isMounted ? msg.timestamp : '--:--:--'}
                            </div>
                        </div>
                    </div>
                ))}

                {/* Typing Indicator */}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-cyan-500/30 border border-purple-500/30 flex items-center justify-center shrink-0">
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                        </div>
                        <div className="bg-slate-900/80 border border-slate-700 rounded-lg p-3 text-sm text-slate-400">
                            <div className="flex items-center gap-2">
                                <span>Sherlock is analyzing</span>
                                <span className="flex gap-1">
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Suggested Questions */}
                {showSuggestions && messages.length <= 1 && (
                    <div className="pt-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                            <Zap className="w-3 h-3" />
                            Quick Questions
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {SUGGESTED_QUESTIONS.map((q, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSubmit(undefined, q)}
                                    className="text-xs px-3 py-1.5 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-all"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </CardContent>

            <div className="p-4 border-t border-slate-800 bg-slate-900/30 mt-auto">
                <form onSubmit={handleSubmit} className="relative flex gap-2">
                    <div className="relative flex-1">
                        <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask Sherlock about fraud patterns..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-slate-200"
                            disabled={isLoading}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="neon"
                        size="icon"
                        disabled={isLoading || !input.trim()}
                        className="shrink-0"
                    >
                        {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                    </Button>
                </form>
            </div>
        </Card>
    );
}
