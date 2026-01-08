import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AddMaterialsPage } from './add-materials.page';

describe('AddMaterialsPage', () => {
  let component: AddMaterialsPage;
  let fixture: ComponentFixture<AddMaterialsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(AddMaterialsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
