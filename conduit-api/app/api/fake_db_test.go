package api

import (
	"context"
	"database/sql"

	"conduit-monorepo/conduit-api/internal/db"
)

type fakeDB struct {
	createGroupFn                        func(ctx context.Context, arg db.CreateGroupParams) (db.Group, error)
	addMembershipFn                      func(ctx context.Context, arg db.AddMembershipParams) (db.Membership, error)
	upsertOrganizationSubscriptionFn     func(ctx context.Context, arg db.UpsertOrganizationSubscriptionParams) (db.OrganizationSubscription, error)
	getOrganizationSubscriptionByGroupFn func(ctx context.Context, groupID int64) (db.OrganizationSubscription, error)
	getUsagePeriodByGroupAndStartFn      func(ctx context.Context, arg db.GetUsagePeriodByGroupAndStartParams) (db.SubscriptionUsagePeriod, error)
	createUsagePeriodFn                  func(ctx context.Context, arg db.CreateUsagePeriodParams) (db.SubscriptionUsagePeriod, error)
	countMembersByGroupFn                func(ctx context.Context, groupID int64) (int64, error)
	withinTxFn                           func(ctx context.Context, fn func(db.Querier) error) error
	listGroupMembershipsFn               func(ctx context.Context, groupID int64) ([]db.Membership, error)
	listGroupsByOwnerFn                  func(ctx context.Context, ownerID int64) ([]db.Group, error)
	listGroupsByMemberFn                 func(ctx context.Context, userID int64) ([]db.Group, error)
	createJoinRequestFn                  func(ctx context.Context, arg db.CreateJoinRequestParams) (db.JoinRequest, error)
	listJoinRequestsByGroupFn            func(ctx context.Context, groupID int64) ([]db.JoinRequest, error)
	updateJoinRequestStatusFn            func(ctx context.Context, arg db.UpdateJoinRequestStatusParams) (db.JoinRequest, error)
	getJoinRequestFn                     func(ctx context.Context, arg db.GetJoinRequestParams) (db.JoinRequest, error)
	updateGroupIsOpenFn                  func(ctx context.Context, arg db.UpdateGroupIsOpenParams) (db.Group, error)
	deleteMembershipFn                   func(ctx context.Context, arg db.DeleteMembershipParams) (db.Membership, error)
	updateGroupFn                        func(ctx context.Context, arg db.UpdateGroupParams) (db.Group, error)
	deleteGroupFn                        func(ctx context.Context, id int64) (db.Group, error)
	getGroupByIDFn                       func(ctx context.Context, id int64) (db.Group, error)
	getCollectionFn                      func(ctx context.Context, id int64) (db.Collection, error)
	closeCollectionFn                    func(ctx context.Context, arg db.CloseCollectionParams) (db.Collection, error)
	createCollectionFn                   func(ctx context.Context, arg db.CreateCollectionParams) (db.Collection, error)
	updateCollectionFn                   func(ctx context.Context, arg db.UpdateCollectionParams) (db.Collection, error)
	deleteCollectionFn                   func(ctx context.Context, arg db.DeleteCollectionParams) (db.Collection, error)
	createPaymentFn                      func(ctx context.Context, arg db.CreatePaymentParams) (db.Payment, error)
	createCashPaymentFn                  func(ctx context.Context, paymentID int64) (db.CashPayment, error)
	createCollectionFormFn               func(ctx context.Context, arg db.CreateCollectionFormParams) (db.CollectionForm, error)
	updateCollectionFormFn               func(ctx context.Context, arg db.UpdateCollectionFormParams) (db.CollectionForm, error)
	deleteCollectionFormFn               func(ctx context.Context, id int64) (db.CollectionForm, error)
	getCollectionFormByCollectionIDFn    func(ctx context.Context, collectionID int64) (db.CollectionForm, error)
	getCollectionFormByIDFn              func(ctx context.Context, id int64) (db.CollectionForm, error)
	listCollectionFormFieldsFn           func(ctx context.Context, formID int64) ([]db.CollectionFormField, error)
	createCollectionFormFieldFn          func(ctx context.Context, arg db.CreateCollectionFormFieldParams) (db.CollectionFormField, error)
	createFormSubmissionFn               func(ctx context.Context, arg db.CreateFormSubmissionParams) (db.CollectionFormSubmission, error)
	addFormAnswerFn                      func(ctx context.Context, arg db.AddFormAnswerParams) (db.CollectionFormAnswer, error)
	getPaymentByIDFn                     func(ctx context.Context, id int64) (db.Payment, error)
	getCashPaymentByPaymentIDFn          func(ctx context.Context, paymentID int64) (db.CashPayment, error)
	getPaymentByStripePaymentIntentIDFn  func(ctx context.Context, stripePaymentIntentID string) (db.Payment, error)
	confirmCashPaymentFn                 func(ctx context.Context, arg db.ConfirmCashPaymentParams) (db.CashPayment, error)
	markPaymentPaidFn                    func(ctx context.Context, id int64) (db.Payment, error)
	markPaymentFailedFn                  func(ctx context.Context, id int64) (db.Payment, error)
	listPaymentsByCollectionFn           func(ctx context.Context, collectionID int64) ([]db.Payment, error)
	listFormSubmissionsByCollectionFn    func(ctx context.Context, collectionID int64) ([]db.CollectionFormSubmission, error)
	getFormSubmissionByIDFn              func(ctx context.Context, id int64) (db.CollectionFormSubmission, error)
	updateFormSubmissionFn               func(ctx context.Context, arg db.UpdateFormSubmissionParams) (db.CollectionFormSubmission, error)
	deleteFormSubmissionFn               func(ctx context.Context, id int64) (db.CollectionFormSubmission, error)
	listFormAnswersBySubmissionFn        func(ctx context.Context, submissionID int64) ([]db.CollectionFormAnswer, error)
	getFormAnswerByIDFn                  func(ctx context.Context, id int64) (db.CollectionFormAnswer, error)
	updateFormAnswerFn                   func(ctx context.Context, arg db.UpdateFormAnswerParams) (db.CollectionFormAnswer, error)
	deleteFormAnswerFn                   func(ctx context.Context, id int64) (db.CollectionFormAnswer, error)
	getGroupByJoinCodeFn                 func(ctx context.Context, joinCode string) (db.Group, error)
	listJoinRequestsByUserFn             func(ctx context.Context, userID int64) ([]db.ListJoinRequestsByUserRow, error)
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
func (f *fakeDB) CountMembersByGroup(ctx context.Context, groupID int64) (int64, error) {
	if f.countMembersByGroupFn != nil {
		return f.countMembersByGroupFn(ctx, groupID)
	}
	if f.listGroupMembershipsFn != nil {
		memberships, err := f.listGroupMembershipsFn(ctx, groupID)
		if err != nil {
			return 0, err
		}
		return int64(len(memberships)), nil
	}
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
func (f *fakeDB) CreateCashPayment(ctx context.Context, paymentID int64) (db.CashPayment, error) {
	if f.createCashPaymentFn != nil {
		return f.createCashPaymentFn(ctx, paymentID)
	}
	return db.CashPayment{}, nil
}
func (f *fakeDB) CreateRefreshToken(ctx context.Context, arg db.CreateRefreshTokenParams) (db.RefreshToken, error) {
	return db.RefreshToken{}, nil
}
func (f *fakeDB) CreateUsagePeriod(ctx context.Context, arg db.CreateUsagePeriodParams) (db.SubscriptionUsagePeriod, error) {
	if f.createUsagePeriodFn != nil {
		return f.createUsagePeriodFn(ctx, arg)
	}
	return db.SubscriptionUsagePeriod{GroupID: arg.GroupID, PeriodStart: arg.PeriodStart, PeriodEnd: arg.PeriodEnd, TransactionCount: arg.TransactionCount, GrossAmount: arg.GrossAmount, FeeAmount: arg.FeeAmount}, nil
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
func (f *fakeDB) GetOrganizationSubscriptionByGroup(ctx context.Context, groupID int64) (db.OrganizationSubscription, error) {
	if f.getOrganizationSubscriptionByGroupFn != nil {
		return f.getOrganizationSubscriptionByGroupFn(ctx, groupID)
	}
	return db.OrganizationSubscription{GroupID: groupID, Tier: db.SubscriptionTierFree, MemberLimit: 25, TransactionCapacityPerPeriod: 250, TransactionFeeBps: 50}, nil
}
func (f *fakeDB) GetRefreshTokenByTokenID(ctx context.Context, tokenID string) (db.RefreshToken, error) {
	return db.RefreshToken{}, nil
}
func (f *fakeDB) GetUsagePeriodByGroupAndStart(ctx context.Context, arg db.GetUsagePeriodByGroupAndStartParams) (db.SubscriptionUsagePeriod, error) {
	if f.getUsagePeriodByGroupAndStartFn != nil {
		return f.getUsagePeriodByGroupAndStartFn(ctx, arg)
	}
	return db.SubscriptionUsagePeriod{}, sql.ErrNoRows
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
func (f *fakeDB) ListGroupsByMember(ctx context.Context, userID int64) ([]db.Group, error) {
	if f.listGroupsByMemberFn != nil {
		return f.listGroupsByMemberFn(ctx, userID)
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
func (f *fakeDB) GetJoinRequest(ctx context.Context, arg db.GetJoinRequestParams) (db.JoinRequest, error) {
	if f.getJoinRequestFn != nil {
		return f.getJoinRequestFn(ctx, arg)
	}
	return db.JoinRequest{}, sql.ErrNoRows
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
func (f *fakeDB) GetPaymentByID(ctx context.Context, id int64) (db.Payment, error) {
	if f.getPaymentByIDFn != nil {
		return f.getPaymentByIDFn(ctx, id)
	}
	return db.Payment{}, nil
}
func (f *fakeDB) GetCashPaymentByPaymentID(ctx context.Context, paymentID int64) (db.CashPayment, error) {
	if f.getCashPaymentByPaymentIDFn != nil {
		return f.getCashPaymentByPaymentIDFn(ctx, paymentID)
	}
	return db.CashPayment{}, nil
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
	if f.markPaymentFailedFn != nil {
		return f.markPaymentFailedFn(ctx, id)
	}
	return db.Payment{}, nil
}
func (f *fakeDB) MarkPaymentPaid(ctx context.Context, id int64) (db.Payment, error) {
	if f.markPaymentPaidFn != nil {
		return f.markPaymentPaidFn(ctx, id)
	}
	return db.Payment{}, nil
}
func (f *fakeDB) ConfirmCashPayment(ctx context.Context, arg db.ConfirmCashPaymentParams) (db.CashPayment, error) {
	if f.confirmCashPaymentFn != nil {
		return f.confirmCashPaymentFn(ctx, arg)
	}
	return db.CashPayment{}, nil
}
func (f *fakeDB) IncrementUsageForPayment(ctx context.Context, arg db.IncrementUsageForPaymentParams) (db.SubscriptionUsagePeriod, error) {
	return db.SubscriptionUsagePeriod{}, nil
}

func (f *fakeDB) WithinTx(ctx context.Context, fn func(db.Querier) error) error {
	if f.withinTxFn != nil {
		return f.withinTxFn(ctx, fn)
	}
	return fn(f)
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

func (f *fakeDB) GetPaymentByStripePaymentIntentID(ctx context.Context, stripePaymentIntentID string) (db.Payment, error) {
	if f.getPaymentByStripePaymentIntentIDFn != nil {
		return f.getPaymentByStripePaymentIntentIDFn(ctx, stripePaymentIntentID)
	}
	return db.Payment{}, nil
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

func (f *fakeDB) UpsertOrganizationSubscription(ctx context.Context, arg db.UpsertOrganizationSubscriptionParams) (db.OrganizationSubscription, error) {
	if f.upsertOrganizationSubscriptionFn != nil {
		return f.upsertOrganizationSubscriptionFn(ctx, arg)
	}
	return db.OrganizationSubscription{}, nil
}

func (f *fakeDB) GetGroupByJoinCode(ctx context.Context, joinCode string) (db.Group, error) {
	if f.getGroupByJoinCodeFn != nil {
		return f.getGroupByJoinCodeFn(ctx, joinCode)
	}
	return db.Group{}, nil
}

func (f *fakeDB) ListJoinRequestsByUser(ctx context.Context, userID int64) ([]db.ListJoinRequestsByUserRow, error) {
	if f.listJoinRequestsByUserFn != nil {
		return f.listJoinRequestsByUserFn(ctx, userID)
	}
	return nil, nil
}
