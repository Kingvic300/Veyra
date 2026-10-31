import { Injectable } from '@nestjs/common';
import type { CreateOrganisationInput, Organisation } from '@veyra/core';
import { AccessService } from '../access/access.service.js';
import { ChainService } from '../chain/chain.service.js';
import { badRequest } from '../common/errors.js';
import { ContractorsService } from '../contractors/contractors.service.js';
import { OrganisationsService } from './organisations.service.js';

export interface GoLiveResult {
  organisation: Organisation;
  copiedMembers: number;
  copiedPeople: number;
  /** People whose practice wallet (sim:…) does not exist on the new network. */
  peopleNeedingWallets: { name: string; email: string | null; country: string | null }[];
}

/**
 * Practice organisations cannot be converted in place: their balances,
 * addresses, receipts and history belong to the simulated ledger. Going live
 * creates a new organisation on a real network and copies the team, approval
 * rules and people across. The practice organisation is left untouched.
 */
@Injectable()
export class GoLiveService {
  constructor(
    private readonly access: AccessService,
    private readonly chain: ChainService,
    private readonly orgs: OrganisationsService,
    private readonly contractors: ContractorsService,
  ) {}

  async goLive(userId: string, practiceOrgId: string, input: CreateOrganisationInput): Promise<GoLiveResult> {
    const { org: practice, member: actor } = await this.access.require(userId, practiceOrgId, 'org:manage');
    if (practice.chain !== 'simulated') throw badRequest('ALREADY_LIVE', 'Only practice companies can go live.');
    if (input.chain === 'simulated') throw badRequest('STILL_PRACTICE', 'Choose a real payment option to go live.');

    const organisation = await this.orgs.create(userId, input);

    let copiedMembers = 0;
    for (const m of await this.orgs.listMembers(userId, practiceOrgId)) {
      if (m.userId === actor.userId) continue;
      // Practice wallets are not real accounts; approvers link theirs again on the live network.
      await this.orgs.addMember(userId, organisation.id, { email: m.email, role: m.role, walletAddress: null });
      copiedMembers += 1;
    }

    const live = this.chain.adapter(organisation);
    let copiedPeople = 0;
    const peopleNeedingWallets: GoLiveResult['peopleNeedingWallets'] = [];
    for (const c of await this.contractors.list(userId, practiceOrgId, false)) {
      if (!live.isValidAddress(c.payoutAddress)) {
        peopleNeedingWallets.push({ name: c.name, email: c.email, country: c.country });
        continue;
      }
      await this.contractors.create(userId, organisation.id, { name: c.name, email: c.email, country: c.country, payoutAddress: c.payoutAddress });
      copiedPeople += 1;
    }

    return { organisation, copiedMembers, copiedPeople, peopleNeedingWallets };
  }
}
