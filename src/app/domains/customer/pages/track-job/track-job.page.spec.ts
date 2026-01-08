import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrackJobPage } from './track-job.page';

describe('TrackJobPage', () => {
  let component: TrackJobPage;
  let fixture: ComponentFixture<TrackJobPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TrackJobPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
