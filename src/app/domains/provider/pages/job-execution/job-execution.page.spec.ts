import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JobExecutionPage } from './job-execution.page';

describe('JobExecutionPage', () => {
  let component: JobExecutionPage;
  let fixture: ComponentFixture<JobExecutionPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(JobExecutionPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
