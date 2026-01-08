import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerTabsPage } from './customer-tabs.page';

describe('CustomerTabsPage', () => {
  let component: CustomerTabsPage;
  let fixture: ComponentFixture<CustomerTabsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(CustomerTabsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
