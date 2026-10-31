import { Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import {
  approveBatchSchema,
  cancelBatchSchema,
  chainTxSchema,
  createBatchSchema,
  executeBatchSchema,
  formatUnits,
  updateBatchSchema,
} from '@veyra/core';
import type { TransactionKind } from '@veyra/chain-adapter';
import { CurrentUser, type AuthUser } from '../auth/decorators.js';
import { badRequest, parse } from '../common/errors.js';
import { BatchesService } from './batches.service.js';

const KINDS: TransactionKind[] = ['propose', 'approve', 'execute', 'cancel'];

@Controller('organisations/:orgId/batches')
export class BatchesController {
  constructor(private readonly batches: BatchesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Query('status') status?: string) {
    return this.batches.list(user.id, orgId, status);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Body() body: unknown) {
    return this.batches.create(user.id, orgId, parse(createBatchSchema, body));
  }

  @Get(':batchId')
  get(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string) {
    return this.batches.get(user.id, orgId, batchId);
  }

  @Patch(':batchId')
  update(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string, @Body() body: unknown) {
    return this.batches.update(user.id, orgId, batchId, parse(updateBatchSchema, body));
  }

  @Post(':batchId/validate')
  @HttpCode(200)
  async validate(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string) {
    const { items: _items, ...result } = await this.batches.validate(user.id, orgId, batchId);
    return result;
  }

  @Post(':batchId/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string) {
    return this.batches.submit(user.id, orgId, batchId);
  }

  @Post(':batchId/proposal')
  @HttpCode(200)
  proposal(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string, @Body() body: unknown) {
    return this.batches.recordProposal(user.id, orgId, batchId, parse(chainTxSchema, body).txHash);
  }

  @Post(':batchId/approvals')
  @HttpCode(200)
  approve(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string, @Body() body: unknown) {
    return this.batches.approve(user.id, orgId, batchId, parse(approveBatchSchema, body).txHash);
  }

  @Post(':batchId/execute')
  @HttpCode(200)
  execute(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string, @Body() body: unknown) {
    return this.batches.execute(user.id, orgId, batchId, parse(executeBatchSchema, body).txHash);
  }

  @Post(':batchId/cancel')
  @HttpCode(200)
  cancel(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string, @Body() body: unknown) {
    return this.batches.cancel(user.id, orgId, batchId, parse(cancelBatchSchema, body).reason);
  }

  @Post(':batchId/reconcile')
  @HttpCode(202)
  reconcile(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string) {
    return this.batches.reconcile(user.id, orgId, batchId);
  }

  @Get(':batchId/chain-actions/:kind')
  chainAction(
    @CurrentUser() user: AuthUser,
    @Param('orgId') orgId: string,
    @Param('batchId') batchId: string,
    @Param('kind') kind: string,
  ) {
    if (!KINDS.includes(kind as TransactionKind)) throw badRequest('UNKNOWN_ACTION', `Unknown chain action ${kind}`);
    return this.batches.chainAction(user.id, orgId, batchId, kind as TransactionKind);
  }

  @Get(':batchId/receipt')
  receipt(@CurrentUser() user: AuthUser, @Param('orgId') orgId: string, @Param('batchId') batchId: string) {
    return this.batches.receipt(user.id, orgId, batchId);
  }

  @Get(':batchId/receipt.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async receiptCsv(
    @CurrentUser() user: AuthUser,
    @Param('orgId') orgId: string,
    @Param('batchId') batchId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const r = await this.batches.receipt(user.id, orgId, batchId);
    res.setHeader('Content-Disposition', `attachment; filename="veyra-receipt-${batchId}.csv"`);
    const header = ['contractor', 'recipient', 'amount', 'amount_base_units', 'asset', 'status', 'tx_hash'];
    const lines = r.items.map((i) =>
      [i.contractorName, i.recipient, formatUnits(i.amount, r.batch.asset.decimals), i.amount, r.batch.asset.symbol, i.status, i.txHash ?? '']
        .map(csvCell)
        .join(','),
    );
    return [header.join(','), ...lines].join('\n') + '\n';
  }
}

/** Quote a CSV cell and neutralise spreadsheet formula injection. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
