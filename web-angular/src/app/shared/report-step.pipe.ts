import { Pipe, PipeTransform } from '@angular/core';
import { REPORT_STEP_LABEL, ReportStatus } from '../core/models';

/** {{ report.status | reportStep }} → "Sent to maintenance" instead of the database's "Under Inspection". */
@Pipe({ name: 'reportStep' })
export class ReportStepPipe implements PipeTransform {
  transform(status: ReportStatus): string {
    return REPORT_STEP_LABEL[status] ?? status;
  }
}
