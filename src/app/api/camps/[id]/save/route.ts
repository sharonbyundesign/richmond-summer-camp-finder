import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// POST to save a camp
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campId } = await params;
    
    // For now, we'll use a simple approach with localStorage on the client side
    // In a production app, you'd want to save this to a database table like saved_camps
    // with user_id and camp_id
    
    // This endpoint can be used to validate the camp exists
    const { data, error } = await supabase
      .from('camps')
      .select('id')
      .eq('id', campId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Camp not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Camp saved',
      campId 
    });
  } catch (err) {
    console.error('Error in save camp API:', err);
    return NextResponse.json(
      { error: 'An error occurred while saving the camp' },
      { status: 500 }
    );
  }
}

// DELETE to unsave a camp
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campId } = await params;
    
    // Validate camp exists
    const { data, error } = await supabase
      .from('camps')
      .select('id')
      .eq('id', campId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Camp not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Camp unsaved',
      campId 
    });
  } catch (err) {
    console.error('Error in unsave camp API:', err);
    return NextResponse.json(
      { error: 'An error occurred while unsaving the camp' },
      { status: 500 }
    );
  }
}

