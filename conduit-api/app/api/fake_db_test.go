package api

import (
	"context"

	"conduit-monorepo/conduit-api/internal/db"
)

type fakeDB struct {
	createGroupFn                     func(ctx context.Context, arg db.CreateGroupParams) (db.Group, error)
	addMembershipFn                   func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error)
	listGroupMembershipsFn            func(ctx context.Context, groupID int64) ([]db.Membership, error)
	listGroupsByOwnerFn               func(ctx context.Context, ownerID int64) ([]db.Group, error)
	createJoinRequestFn               func(ctx context.Context, arg db.CreateJoinRequestParams) (db.JoinRequest, error)
	listJoinRequestsByGroupFn         func(ctx context.Context, groupID int64) ([]db.JoinRequest, error)
	updateJoinRequestStatusFn         func(ctx context.Context, arg db.UpdateJoinRequestStatusParams) (db.JoinRequest, error)
	updateGroupIsOpenFn               func(ctx context.Context, arg db.UpdateGroupIsOpenParams) (db.Group, error)
	deleteMembershipFn                func(ctx context.Context, arg db.DeleteMembershipParams) (db.Membership, error)
	updateGroupFn                     func(ctx context.Context, arg db.UpdateGroupParams) (db.Group, error)
	deleteGroupFn                     func(ctx context.Context, id int64) (db.Group, error)
	getGroupByIDFn                    func(ctx context.Context, id int64) (db.Group, error)
	getCollectionFn                   func(ctx context.Context, id int64) (db.Collection, error)
	closeCollectionFn                 func(ctx context.Context, arg db.CloseCollectionParams) (db.Collection, error)
	createCollectionFn                func(ctx context.Context, arg db.CreateCollectionParams) (db.Collection, error)
	updateCollectionFn                func(ctx context.Context, arg db.UpdateCollectionParams) (db.Collection, error)
	deleteCollectionFn                func(ctx context.Context, arg db.DeleteCollectionParams) (db.Collection, error)
	createPaymentFn                   func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error)
	createCollectionFormFn            func(ctx context.Context, arg db.CreateCollectionFormParams) (db.CollectionForm, error)
	updateCollectionFormFn            func(ctx context.Context, arg db.UpdateCollectionFormParams) (db.CollectionForm, error)
	deleteCollectionFormFn            func(ctx context.Context, id int64) (db.CollectionForm, error)
	getCollectionFormByCollectionIDFn func(ctx context.Context, collectionID int64) (db.CollectionForm, error)
	getCollectionFormByIDFn           func(ctx context.Context, id int64) (db.CollectionForm, error)
	listCollectionFormFieldsFn        func(ctx context.Context, formID int64) ([]db.CollectionFormField, error)
	createCollectionFormFieldFn       func(ctx context.Context, arg db.CreateCollectionFormFieldParams) (db.CollectionFormField, error)
	createFormSubmissionFn            func(ctx context.Context, arg db.CreateFormSubmissionParams) (db.CollectionFormSubmission, error)
	addFormAnswerFn                   func(ctx context.Context, arg db.AddFormAnswerParams) (db.CollectionFormAnswer, error)
	listPaymentsByCollectionFn        func(ctx context.Context, collectionID int64) ([]db.Payment, error)
	listFormSubmissionsByCollectionFn func(ctx context.Context, collectionID int64) ([]db.CollectionFormSubmission, error)
	getFormSubmissionByIDFn           func(ctx context.Context, id int64) (db.CollectionFormSubmission, error)
	updateFormSubmissionFn            func(ctx context.Context, arg db.UpdateFormSubmissionParams) (db.CollectionFormSubmission, error)
	deleteFormSubmissionFn            func(ctx context.Context, id int64) (db.CollectionFormSubmission, error)
	listFormAnswersBySubmissionFn     func(ctx context.Context, submissionID int64) ([]db.CollectionFormAnswer, error)
	getFormAnswerByIDFn               func(ctx context.Context, id int64) (db.CollectionFormAnswer, error)
	updateFormAnswerFn                func(ctx context.Context, arg db.UpdateFormAnswerParams) (db.CollectionFormAnswer, error)
	deleteFormAnswerFn                func(ctx context.Context, id int64) (db.CollectionFormAnswer, error)
}

var _ db.Querier = (*fakeDB)(nil)

func (f *fakeDB) AddMembership(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error) {
	if f.addMembershipFn != nil {
		return f.addMembershipFn(ctx, arg)
	}
	return db.Membership{}, nil
}
func (f *fakeDB) CloseCollection(ctx context.Context, arg db.CloseCollectionParams) (db.Collection, error) {
	if f.closeCollectionFn != nil {
		return f.closeCollectionFn(ctx, arg)
	}
	return db.Collection{}, nil
}
func (f *fakeDB) ConsumePasswordResetToken(ctx context.Context, tokenHash string) (int64, error) {
	return 0, nil
}
func (f *fakeDB) CreateCollection(ctx context.Context, arg db.CreateCollectionParams) (db.Collection, error) {
	if f.createCollectionFn != nil {
		return f.createCollectionFn(ctx, arg)
	}
	return db.Collection{}, nil
}
func (f *fakeDB) CreateCollectionForm(ctx context.Context, arg db.CreateCollectionFormParams) (db.CollectionForm, error) {
	if f.createCollectionFormFn != nil {
		return f.createCollectionFormFn(ctx, arg)
	}
	return db.CollectionForm{}, nil
}
func (f *fakeDB) CreateCollectionFormField(ctx context.Context, arg db.CreateCollectionFormFieldParams) (db.CollectionFormField, error) {
	if f.createCollectionFormFieldFn != nil {
		return f.createCollectionFormFieldFn(ctx, arg)
	}
	return db.CollectionFormField{}, nil
}
func (f *fakeDB) CreateFormSubmission(ctx context.Context, arg db.CreateFormSubmissionParams) (db.CollectionFormSubmission, error) {
	if f.createFormSubmissionFn != nil {
		return f.createFormSubmissionFn(ctx, arg)
	}
	return db.CollectionFormSubmission{}, nil
}
func (f *fakeDB) CreateGroup(ctx context.Context, arg db.CreateGroupParams) (db.Group, error) {
	if f.createGroupFn != nil {
		return f.createGroupFn(ctx, arg)
	}
	return db.Group{}, nil
}
func (f *fakeDB) CreatePasswordResetToken(ctx context.Context, arg db.CreatePasswordResetTokenParams) (db.PasswordResetToken, error) {
	return db.PasswordResetToken{}, nil
}
func (f *fakeDB) CreatePayment(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error) {
	if f.createPaymentFn != nil {
		return f.createPaymentFn(ctx, arg)
	}
	return db.Payment{}, nil
}
func (f *fakeDB) CreateRefreshToken(ctx context.Context, arg db.CreateRefreshTokenParams) (db.RefreshToken, error) {
	return db.RefreshToken{}, nil
}
func (f *fakeDB) CreateUser(ctx context.Context, email string) (db.User, error) {
	return db.User{}, nil
}
func (f *fakeDB) CreateUserCredential(ctx context.Context, arg db.CreateUserCredentialParams) (db.User, error) {
	return db.User{}, nil
}
func (f *fakeDB) GetCollectionFormByCollectionID(ctx context.Context, collectionID int64) (db.CollectionForm, error) {
	if f.getCollectionFormByCollectionIDFn != nil {
		return f.getCollectionFormByCollectionIDFn(ctx, collectionID)
	}
	return db.CollectionForm{}, nil
}
func (f *fakeDB) GetRefreshTokenByTokenID(ctx context.Context, tokenID string) (db.RefreshToken, error) {
	return db.RefreshToken{}, nil
}
func (f *fakeDB) GetUserByEmail(ctx context.Context, email string) (db.User, error) {
	return db.User{}, nil
}
func (f *fakeDB) GetUserByID(ctx context.Context, id int64) (db.User, error) { return db.User{}, nil }
func (f *fakeDB) GetUserCredentialByEmail(ctx context.Context, email string) (db.User, error) {
	return db.User{}, nil
}
func (f *fakeDB) ListCollectionFormFields(ctx context.Context, formID int64) ([]db.CollectionFormField, error) {
	if f.listCollectionFormFieldsFn != nil {
		return f.listCollectionFormFieldsFn(ctx, formID)
	}
	return nil, nil
}
func (f *fakeDB) ListCollectionsByGroup(ctx context.Context, groupID int64) ([]db.Collection, error) {
	return nil, nil
}
func (f *fakeDB) ListFormAnswersBySubmission(ctx context.Context, submissionID int64) ([]db.CollectionFormAnswer, error) {
	if f.listFormAnswersBySubmissionFn != nil {
		return f.listFormAnswersBySubmissionFn(ctx, submissionID)
	}
	return nil, nil
}
func (f *fakeDB) ListGroupMemberships(ctx context.Context, groupID int64) ([]db.Membership, error) {
	if f.listGroupMembershipsFn != nil {
		return f.listGroupMembershipsFn(ctx, groupID)
	}
	return nil, nil
}
func (f *fakeDB) UpdateMembership(ctx context.Context, arg db.UpdateMembershipParams) (db.Membership, error) {
	// For tests, emulate updating membership by returning the provided args
	return db.Membership{UserID: arg.Column1, GroupID: arg.Column2, Role: arg.Column3}, nil
}
func (f *fakeDB) ListGroupsByOwner(ctx context.Context, ownerID int64) ([]db.Group, error) {
	if f.listGroupsByOwnerFn != nil {
		return f.listGroupsByOwnerFn(ctx, ownerID)
	}
	return nil, nil
}
func (f *fakeDB) CreateJoinRequest(ctx context.Context, arg db.CreateJoinRequestParams) (db.JoinRequest, error) {
	if f.createJoinRequestFn != nil {
		return f.createJoinRequestFn(ctx, arg)
	}
	return db.JoinRequest{}, nil
}
func (f *fakeDB) ListJoinRequestsByGroup(ctx context.Context, groupID int64) ([]db.JoinRequest, error) {
	if f.listJoinRequestsByGroupFn != nil {
		return f.listJoinRequestsByGroupFn(ctx, groupID)
	}
	return nil, nil
}
func (f *fakeDB) UpdateJoinRequestStatus(ctx context.Context, arg db.UpdateJoinRequestStatusParams) (db.JoinRequest, error) {
	if f.updateJoinRequestStatusFn != nil {
		return f.updateJoinRequestStatusFn(ctx, arg)
	}
	return db.JoinRequest{}, nil
}
func (f *fakeDB) UpdateGroupIsOpen(ctx context.Context, arg db.UpdateGroupIsOpenParams) (db.Group, error) {
	if f.updateGroupIsOpenFn != nil {
		return f.updateGroupIsOpenFn(ctx, arg)
	}
	return db.Group{}, nil
}
func (f *fakeDB) DeleteMembership(ctx context.Context, arg db.DeleteMembershipParams) (db.Membership, error) {
	if f.deleteMembershipFn != nil {
		return f.deleteMembershipFn(ctx, arg)
	}
	return db.Membership{}, nil
}
func (f *fakeDB) UpdateGroup(ctx context.Context, arg db.UpdateGroupParams) (db.Group, error) {
	if f.updateGroupFn != nil {
		return f.updateGroupFn(ctx, arg)
	}
	return db.Group{}, nil
}
func (f *fakeDB) DeleteGroup(ctx context.Context, id int64) (db.Group, error) {
	if f.deleteGroupFn != nil {
		return f.deleteGroupFn(ctx, id)
	}
	return db.Group{}, nil
}
func (f *fakeDB) GetGroupByID(ctx context.Context, id int64) (db.Group, error) {
	if f.getGroupByIDFn != nil {
		return f.getGroupByIDFn(ctx, id)
	}
	return db.Group{}, nil
}

func (f *fakeDB) GetCollection(ctx context.Context, id int64) (db.Collection, error) {
	if f.getCollectionFn != nil {
		return f.getCollectionFn(ctx, id)
	}
	return db.Collection{}, nil
}
func (f *fakeDB) ListPaymentsByCollection(ctx context.Context, collectionID int64) ([]db.Payment, error) {
	if f.listPaymentsByCollectionFn != nil {
		return f.listPaymentsByCollectionFn(ctx, collectionID)
	}
	return nil, nil
}
func (f *fakeDB) ListUsers(ctx context.Context, arg db.ListUsersParams) ([]db.User, error) {
	return nil, nil
}
func (f *fakeDB) MarkPasswordResetTokensUsedForUser(ctx context.Context, userID int64) error {
	return nil
}
func (f *fakeDB) MarkPaymentFailed(ctx context.Context, id int64) (db.Payment, error) {
	return db.Payment{}, nil
}
func (f *fakeDB) MarkPaymentPaid(ctx context.Context, id int64) (db.Payment, error) {
	return db.Payment{}, nil
}
func (f *fakeDB) RevokeRefreshToken(ctx context.Context, tokenID string) error       { return nil }
func (f *fakeDB) RevokeRefreshTokensForUser(ctx context.Context, userID int64) error { return nil }
func (f *fakeDB) UpdateUserPasswordHash(ctx context.Context, arg db.UpdateUserPasswordHashParams) error {
	return nil
}

func (f *fakeDB) ListFormSubmissionsByCollection(ctx context.Context, collectionID int64) ([]db.CollectionFormSubmission, error) {
	if f.listFormSubmissionsByCollectionFn != nil {
		return f.listFormSubmissionsByCollectionFn(ctx, collectionID)
	}
	return nil, nil
}

func (f *fakeDB) UpdateCollection(ctx context.Context, arg db.UpdateCollectionParams) (db.Collection, error) {
	if f.updateCollectionFn != nil {
		return f.updateCollectionFn(ctx, arg)
	}
	return db.Collection{}, nil
}

func (f *fakeDB) UpdateCollectionForm(ctx context.Context, arg db.UpdateCollectionFormParams) (db.CollectionForm, error) {
	if f.updateCollectionFormFn != nil {
		return f.updateCollectionFormFn(ctx, arg)
	}
	return db.CollectionForm{}, nil
}

func (f *fakeDB) UpdateFormAnswer(ctx context.Context, arg db.UpdateFormAnswerParams) (db.CollectionFormAnswer, error) {
	if f.updateFormAnswerFn != nil {
		return f.updateFormAnswerFn(ctx, arg)
	}
	return db.CollectionFormAnswer{}, nil
}

func (f *fakeDB) UpdateFormSubmission(ctx context.Context, arg db.UpdateFormSubmissionParams) (db.CollectionFormSubmission, error) {
	if f.updateFormSubmissionFn != nil {
		return f.updateFormSubmissionFn(ctx, arg)
	}
	return db.CollectionFormSubmission{}, nil
}

func (f *fakeDB) DeleteCollection(ctx context.Context, arg db.DeleteCollectionParams) (db.Collection, error) {
	if f.deleteCollectionFn != nil {
		return f.deleteCollectionFn(ctx, arg)
	}
	return db.Collection{}, nil
}

func (f *fakeDB) DeleteCollectionForm(ctx context.Context, id int64) (db.CollectionForm, error) {
	if f.deleteCollectionFormFn != nil {
		return f.deleteCollectionFormFn(ctx, id)
	}
	return db.CollectionForm{}, nil
}

func (f *fakeDB) DeleteFormAnswer(ctx context.Context, id int64) (db.CollectionFormAnswer, error) {
	if f.deleteFormAnswerFn != nil {
		return f.deleteFormAnswerFn(ctx, id)
	}
	return db.CollectionFormAnswer{}, nil
}

func (f *fakeDB) DeleteFormSubmission(ctx context.Context, id int64) (db.CollectionFormSubmission, error) {
	if f.deleteFormSubmissionFn != nil {
		return f.deleteFormSubmissionFn(ctx, id)
	}
	return db.CollectionFormSubmission{}, nil
}

func (f *fakeDB) GetCollectionFormByID(ctx context.Context, id int64) (db.CollectionForm, error) {
	if f.getCollectionFormByIDFn != nil {
		return f.getCollectionFormByIDFn(ctx, id)
	}
	return db.CollectionForm{}, nil
}

func (f *fakeDB) GetFormAnswerByID(ctx context.Context, id int64) (db.CollectionFormAnswer, error) {
	if f.getFormAnswerByIDFn != nil {
		return f.getFormAnswerByIDFn(ctx, id)
	}
	return db.CollectionFormAnswer{}, nil
}

func (f *fakeDB) GetFormSubmissionByID(ctx context.Context, id int64) (db.CollectionFormSubmission, error) {
	if f.getFormSubmissionByIDFn != nil {
		return f.getFormSubmissionByIDFn(ctx, id)
	}
	return db.CollectionFormSubmission{}, nil
}

func (f *fakeDB) AddFormAnswer(ctx context.Context, arg db.AddFormAnswerParams) (db.CollectionFormAnswer, error) {
	if f.addFormAnswerFn != nil {
		return f.addFormAnswerFn(ctx, arg)
	}
	return db.CollectionFormAnswer{}, nil
}
