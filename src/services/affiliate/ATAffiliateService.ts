import { BskyAgent } from '@atproto/api';
import { ComAtprotoRepoCreateRecord } from '@atproto/api';

interface AffiliateProgram {
  uri: string;
  cid: string;
  creator: string;
  name: string;
  description: string;
  commission: number;
  requirements: string[];
  terms: string;
}

interface AffiliateLink {
  uri: string;
  cid: string;
  affiliate: string;
  program: string;
  customId: string;
  createdAt: string;
}

interface AffiliateStats {
  clicks: number;
  conversions: number;
  earnings: number;
  period: 'day' | 'week' | 'month' | 'year';
}

export class ATAffiliateService {
  private agent: BskyAgent;
  private readonly RECORD_NAMESPACE = 'app.bsky.affiliate';

  constructor(agent: BskyAgent) {
    this.agent = agent;
  }

  async createAffiliateProgram(params: {
    name: string;
    description: string;
    commission: number;
    requirements: string[];
    terms: string;
  }): Promise<AffiliateProgram> {
    try {
      const record = {
        $type: `${this.RECORD_NAMESPACE}.program`,
        createdAt: new Date().toISOString(),
        name: params.name,
        description: params.description,
        commission: params.commission,
        requirements: params.requirements,
        terms: params.terms,
      };

      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.program`,
        record,
      });

      return {
        uri: response.uri,
        cid: response.cid,
        creator: this.agent.session?.did || '',
        ...params,
      };
    } catch (error) {
      console.error('Error creating affiliate program:', error);
      throw new Error('Failed to create affiliate program');
    }
  }

  async createAffiliateLink(
    programUri: string,
    customId: string
  ): Promise<AffiliateLink> {
    try {
      const record = {
        $type: `${this.RECORD_NAMESPACE}.link`,
        program: programUri,
        customId,
        createdAt: new Date().toISOString(),
      };

      const response = await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.link`,
        record,
      });

      return {
        uri: response.uri,
        cid: response.cid,
        affiliate: this.agent.session?.did || '',
        program: programUri,
        customId,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error creating affiliate link:', error);
      throw new Error('Failed to create affiliate link');
    }
  }

  async trackClick(linkUri: string): Promise<void> {
    try {
      const record = {
        $type: `${this.RECORD_NAMESPACE}.click`,
        link: linkUri,
        timestamp: new Date().toISOString(),
      };

      await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.click`,
        record,
      });
    } catch (error) {
      console.error('Error tracking click:', error);
      throw new Error('Failed to track click');
    }
  }

  async trackConversion(linkUri: string, amount: number): Promise<void> {
    try {
      const record = {
        $type: `${this.RECORD_NAMESPACE}.conversion`,
        link: linkUri,
        amount,
        timestamp: new Date().toISOString(),
      };

      await this.agent.com.atproto.repo.createRecord({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.conversion`,
        record,
      });
    } catch (error) {
      console.error('Error tracking conversion:', error);
      throw new Error('Failed to track conversion');
    }
  }

  async getAffiliateStats(
    affiliateId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<AffiliateStats> {
    try {
      // Query clicks
      const clicks = await this.agent.com.atproto.repo.listRecords({
        repo: affiliateId,
        collection: `${this.RECORD_NAMESPACE}.click`,
        limit: 100,
      });

      // Query conversions
      const conversions = await this.agent.com.atproto.repo.listRecords({
        repo: affiliateId,
        collection: `${this.RECORD_NAMESPACE}.conversion`,
        limit: 100,
      });

      // Calculate stats based on period
      const startDate = this.getStartDateForPeriod(period);
      const filteredClicks = clicks.records.filter(
        record => new Date(record.value.timestamp) >= startDate
      );
      const filteredConversions = conversions.records.filter(
        record => new Date(record.value.timestamp) >= startDate
      );

      const earnings = filteredConversions.reduce(
        (total, conversion) => total + conversion.value.amount,
        0
      );

      return {
        clicks: filteredClicks.length,
        conversions: filteredConversions.length,
        earnings,
        period,
      };
    } catch (error) {
      console.error('Error getting affiliate stats:', error);
      throw new Error('Failed to get affiliate stats');
    }
  }

  async getAffiliatePrograms(): Promise<AffiliateProgram[]> {
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: this.agent.session?.did,
        collection: `${this.RECORD_NAMESPACE}.program`,
        limit: 100,
      });

      return response.records.map(record => ({
        uri: record.uri,
        cid: record.cid,
        creator: record.value.creator,
        name: record.value.name,
        description: record.value.description,
        commission: record.value.commission,
        requirements: record.value.requirements,
        terms: record.value.terms,
      }));
    } catch (error) {
      console.error('Error getting affiliate programs:', error);
      throw new Error('Failed to get affiliate programs');
    }
  }

  async getAffiliateLinks(affiliateId: string): Promise<AffiliateLink[]> {
    try {
      const response = await this.agent.com.atproto.repo.listRecords({
        repo: affiliateId,
        collection: `${this.RECORD_NAMESPACE}.link`,
        limit: 100,
      });

      return response.records.map(record => ({
        uri: record.uri,
        cid: record.cid,
        affiliate: affiliateId,
        program: record.value.program,
        customId: record.value.customId,
        createdAt: record.value.createdAt,
      }));
    } catch (error) {
      console.error('Error getting affiliate links:', error);
      throw new Error('Failed to get affiliate links');
    }
  }

  private getStartDateForPeriod(
    period: 'day' | 'week' | 'month' | 'year'
  ): Date {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.setDate(now.getDate() - 1));
      case 'week':
        return new Date(now.setDate(now.getDate() - 7));
      case 'month':
        return new Date(now.setMonth(now.getMonth() - 1));
      case 'year':
        return new Date(now.setFullYear(now.getFullYear() - 1));
    }
  }
}
