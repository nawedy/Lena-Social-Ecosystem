import { json } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { debateId } = params;

  try {
    // Fetch main metrics
    const { data: mainMetrics, error: mainError } = await supabase
      .from('debate_metrics')
      .select('*')
      .eq('debate_id', debateId)
      .single();

    if (mainError) throw mainError;

    // Fetch timeline data
    const { data: timelineData, error: timelineError } = await supabase
      .from('debate_timeline_metrics')
      .select('*')
      .eq('debate_id', debateId)
      .order('timestamp', { ascending: true });

    if (timelineError) throw timelineError;

    // Fetch top contributors
    const { data: contributors, error: contributorsError } = await supabase
      .from('debate_contributor_metrics')
      .select(`
        *,
        users:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('debate_id', debateId)
      .order('contributions', { ascending: false })
      .limit(10);

    if (contributorsError) throw contributorsError;

    // Fetch argument types
    const { data: argumentTypes, error: typesError } = await supabase
      .from('debate_argument_types')
      .select('*')
      .eq('debate_id', debateId);

    if (typesError) throw typesError;

    // Format the response
    const metrics = {
      ...mainMetrics,
      timelineData: timelineData.map(item => ({
        timestamp: item.timestamp,
        argumentCount: item.argument_count,
        participantCount: item.participant_count
      })),
      topContributors: contributors.map(contributor => ({
        userId: contributor.user_id,
        userName: contributor.users?.username || 'Anonymous',
        avatarUrl: contributor.users?.avatar_url,
        contributions: contributor.contributions,
        avgStrength: contributor.avg_strength
      })),
      argumentTypes: argumentTypes.map(type => ({
        type: type.type,
        count: type.count
      }))
    };

    return json(metrics);
  } catch (error) {
    console.error('Error fetching debate metrics:', error);
    return json({ error: 'Failed to fetch debate metrics' }, { status: 500 });
  }
}; 