import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FindingPage } from './finding.page';

describe('FindingPage', () => {
  let component: FindingPage;
  let fixture: ComponentFixture<FindingPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FindingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
