import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BookingsPage } from './bookings.page';

describe('BookingsPage', () => {
  let component: ActivityPage;
  let fixture: ComponentFixture<ActivityPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ActivityPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
