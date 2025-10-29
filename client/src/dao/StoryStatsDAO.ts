import { supabase } from '@/integrations/supabase/client';
import { 
  StoryDetailStatistics, 
  StoryView, 
  ReaderActivity, 
  ViewsByDate,
  Comment,
  ListenHistory 
} from '@/types/entities/StoryStatistics';
import { Story, Author, Tag } from '@/types/entities/Story';

/**
 * Data Access Object cho thống kê truyện
 * Lớp này chứa tất cả các hàm truy vấn database để lấy thông tin thống kê
 */
export class StoryStatsDAO {
  
  /**
   * Lấy danh sách tất cả truyện với thống kê cơ bản, sắp xếp theo lượt xem
   */
  static async getStoriesWithStats(limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('admin_story_details')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching stories with stats:', error);
      return { data: null, error };
    }
  }

  /**
   * Lấy top N truyện có nhiều lượt xem nhất
   */
  static async getTopStoriesByViews(limit: number = 10) {
    try {
      const { data, error } = await supabase
        .from('admin_story_details')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error fetching top stories:', error);
      return { data: null, error };
    }
  }

  /**
   * Lấy thống kê chi tiết đầy đủ của một truyện
   */
  static async getStoryDetailStats(storyId: string): Promise<{ data: StoryDetailStatistics | null, error: any }> {
    try {
      // 1. Lấy thông tin cơ bản của truyện
      const { data: storyData, error: storyError } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (storyError || !storyData) {
        console.error('Error fetching story:', storyError);
        throw storyError || new Error('Story not found');
      }

      // Type assertion để giải quyết vấn đề TypeScript
      const typedStoryData = storyData as any;

      // 1b. Lấy thông tin author riêng
      const { data: authorData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', typedStoryData.author_id)
        .single();
      
      const typedAuthorData = authorData as any;

      // 2. Lấy thống kê từ view admin_story_details
      const { data: statsData, error: statsError } = await supabase
        .from('admin_story_details')
        .select('*')
        .eq('id', storyId)
        .single();

      if (statsError || !statsData) {
        console.error('Error fetching stats:', statsError);
        throw statsError || new Error('Stats not found');
      }
      const typedStatsData = statsData as any;

      // 3. Lấy danh sách tags
      const { data: tagsData } = await supabase
        .from('story_tags')
        .select(`
          tags(id, name, slug)
        `)
        .eq('story_id', storyId);

      const tags: Tag[] = tagsData?.map((item: any) => item.tags).filter(Boolean) || [];

      // 4. Lấy lịch sử xem gần đây (20 lượt xem gần nhất)
      const { data: viewsData, error: viewsError } = await supabase
        .from('story_views')
        .select('*')
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (viewsError) {
        console.error('Error fetching views:', viewsError);
      }

      // Lấy thông tin profiles riêng cho các user_id có trong views
      const typedViewsData = viewsData as any[];
      const userIds = typedViewsData?.filter((v: any) => v.user_id).map((v: any) => v.user_id) || [];
      let profilesMap: any = {};
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        profilesMap = profilesData?.reduce((acc: any, p: any) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {}) || {};
      }

      const recent_views: StoryView[] = typedViewsData?.map((view: any) => ({
        id: view.id,
        user_id: view.user_id,
        story_id: view.story_id,
        created_at: view.created_at,
        user_name: view.user_id ? profilesMap[view.user_id] : 'Khách'
      })) || [];

      // 5. Lấy top người đọc (người xem nhiều nhất)
      const { data: topReadersData } = await supabase
        .from('reading_history')
        .select(`
          user_id,
          last_position_seconds,
          last_accessed_at,
          profiles(full_name)
        `)
        .eq('story_id', storyId)
        .order('last_position_seconds', { ascending: false })
        .limit(10);

      const top_readers: ReaderActivity[] = topReadersData?.map((reader: any) => ({
        user_id: reader.user_id,
        user_name: reader.profiles?.full_name || reader.full_name,
        user_email: reader.email || '',
        total_views: reader.view_count || 1,
        total_reading_time: reader.last_position_seconds || 0,
        last_accessed: reader.last_accessed_at
      })) || [];

      // 6. Lấy thống kê xem theo ngày (7 ngày gần nhất)
      const { data: viewsByDateData } = await supabase
        .from('story_views')
        .select('created_at')
        .eq('story_id', storyId)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: true });

      // Nhóm theo ngày
      const viewsByDateMap = new Map<string, number>();
      viewsByDateData?.forEach((view: any) => {
        const date = new Date(view.created_at).toISOString().split('T')[0];
        viewsByDateMap.set(date, (viewsByDateMap.get(date) || 0) + 1);
      });

      const views_by_date: ViewsByDate[] = Array.from(viewsByDateMap.entries()).map(([date, count]) => ({
        date,
        views_count: count
      }));

      // 7. Lấy tổng thời gian nghe
      const { data: listenData } = await supabase
        .from('story_listens')
        .select('listened_seconds')
        .eq('story_id', storyId);

      const total_listening_time = listenData?.reduce((sum: number, item: any) => sum + (item.listened_seconds || 0), 0) || 0;

      // Tạo đối tượng author
      const author: Author = {
        id: typedStoryData.author_id,
        email: '', // Email không có trong profiles
        full_name: typedAuthorData?.full_name || null,
        avatar_url: typedAuthorData?.avatar_url || null
      };

      // Tạo đối tượng story
      const story: Story = {
        id: typedStoryData.id,
        title: typedStoryData.title,
        description: typedStoryData.description,
        content: typedStoryData.content,
        author_id: typedStoryData.author_id,
        cover_image_url: typedStoryData.cover_image_url,
        file_path: typedStoryData.file_path,
        file_type: typedStoryData.file_type,
        audio_url: typedStoryData.audio_url,
        audio_status: typedStoryData.audio_status,
        view_count: typedStoryData.view_count,
        created_at: typedStoryData.created_at,
        updated_at: typedStoryData.updated_at,
        thumbnail_url: typedStoryData.thumbnail_url,
        content_type: typedStoryData.content_type,
        status: typedStoryData.status,
        is_public: typedStoryData.is_public
      };

      // Tạo đối tượng thống kê chi tiết
      const detailStats: StoryDetailStatistics = {
        story,
        author,
        stats: {
          total_views: typedStatsData.view_count || 0,
          unique_views: typedStatsData.views_count || 0,
          total_likes: typedStatsData.likes_count || 0,
          total_comments: typedStatsData.comments_count || 0,
          total_listens: typedStatsData.listens_count || 0,
          total_bookmarks: typedStatsData.bookmarks_count || 0,
          total_listening_time
        },
        tags,
        recent_views,
        top_readers,
        views_by_date
      };

      return { data: detailStats, error: null };
    } catch (error) {
      console.error('Error fetching story detail stats:', error);
      return { data: null, error };
    }
  }

  /**
   * Lấy danh sách bình luận của một truyện
   */
  static async getStoryComments(storyId: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('story_comments')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const comments: Comment[] = data?.map((comment: any) => ({
        id: comment.id,
        story_id: comment.story_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        user_name: comment.profiles?.full_name,
        user_email: ''
      })) || [];

      return { data: comments, error: null };
    } catch (error) {
      console.error('Error fetching story comments:', error);
      return { data: null, error };
    }
  }

  /**
   * Lấy lịch sử nghe của một truyện
   */
  static async getStoryListenHistory(storyId: string, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('story_listens')
        .select(`
          *,
          profiles(full_name)
        `)
        .eq('story_id', storyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const listens: ListenHistory[] = data?.map((listen: any) => ({
        id: listen.id,
        user_id: listen.user_id,
        story_id: listen.story_id,
        listened_seconds: listen.listened_seconds,
        created_at: listen.created_at,
        user_name: listen.profiles?.full_name
      })) || [];

      return { data: listens, error: null };
    } catch (error) {
      console.error('Error fetching story listen history:', error);
      return { data: null, error };
    }
  }

  /**
   * Tìm kiếm truyện theo tiêu đề
   */
  static async searchStoriesByTitle(searchTerm: string, limit: number = 20) {
    try {
      const { data, error } = await supabase
        .from('admin_story_details')
        .select('*')
        .ilike('title', `%${searchTerm}%`)
        .order('view_count', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error searching stories:', error);
      return { data: null, error };
    }
  }
}
