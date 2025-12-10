import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// POST to save a session
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    
    // Validate the session exists
    const { data, error } = await supabase
      .from('camp_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Session saved',
      sessionId 
    });
  } catch (err) {
    console.error('Error in save session API:', err);
    return NextResponse.json(
      { error: 'An error occurred while saving the session' },
      { status: 500 }
    );
  }
}

// DELETE to unsave a session
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    
    // Validate session exists
    const { data, error } = await supabase
      .from('camp_sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Session unsaved',
      sessionId 
    });
  } catch (err) {
    console.error('Error in unsave session API:', err);
    return NextResponse.json(
      { error: 'An error occurred while unsaving the session' },
      { status: 500 }
    );
  }
}

