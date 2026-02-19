import { NextResponse } from 'next/server';
import { seedFraudKnowledgeBase } from '@/lib/rag';

export async function POST() {
    try {
        const result = await seedFraudKnowledgeBase();

        if (result.success) {
            return NextResponse.json({
                success: true,
                message: `Successfully seeded ${result.count} fraud knowledge documents`,
                count: result.count
            });
        } else {
            return NextResponse.json({
                success: false,
                message: 'Failed to seed knowledge base'
            }, { status: 500 });
        }
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            message: error.message || 'Unknown error'
        }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Use POST to seed the fraud knowledge base'
    });
}
