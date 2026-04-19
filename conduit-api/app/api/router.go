package api

import (
	"net/http"

	"conduit-monorepo/conduit-api/app/api/middleware"

	"github.com/gin-gonic/gin"
)

func NewRouter(authHandler *AuthHandler, groupsHandler *GroupsHandler, collectionsHandler *CollectionsHandler, formsHandler *FormsHandler, authService middleware.AccessTokenParser) *gin.Engine {
	router := gin.Default()

	api := router.Group("/api")

	api.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "pong"})
	})

	authGroup := api.Group("/auth")
	authGroup.POST("/register", authHandler.Register)
	authGroup.POST("/login", authHandler.Login)
	authGroup.POST("/forgot-password", authHandler.ForgotPassword)
	authGroup.POST("/reset-password", authHandler.ResetPassword)
	authGroup.POST("/refresh", authHandler.Refresh)
	authGroup.POST("/logout", authHandler.Logout)
	authGroup.GET("/me", middleware.RequireAuth(authService), authHandler.Me)

	// Groups routes
	groups := api.Group("/groups")
	groups.POST("", middleware.RequireAuth(authService), groupsHandler.CreateGroup)
	groups.GET("/owned", middleware.RequireAuth(authService), groupsHandler.ListOwnedGroups)
	groups.POST(":group_id/memberships", middleware.RequireAuth(authService), groupsHandler.AddMembership)
	groups.GET(":group_id/memberships", middleware.RequireAuth(authService), groupsHandler.ListMemberships)
	groups.PATCH(":group_id/is_open", middleware.RequireAuth(authService), groupsHandler.ToggleIsOpen)
	groups.PATCH(":group_id", middleware.RequireAuth(authService), groupsHandler.UpdateGroup)
	groups.DELETE(":group_id", middleware.RequireAuth(authService), groupsHandler.DeleteGroup)
	groups.DELETE(":group_id/memberships/me", middleware.RequireAuth(authService), groupsHandler.LeaveGroup)
	groups.DELETE(":group_id/memberships/:user_id", middleware.RequireAuth(authService), groupsHandler.EjectMember)
	groups.POST(":group_id/join", middleware.RequireAuth(authService), groupsHandler.RequestToJoin)
	groups.GET(":group_id/join-requests", middleware.RequireAuth(authService), groupsHandler.ListJoinRequests)
	groups.PATCH(":group_id/join-requests/:user_id", middleware.RequireAuth(authService), groupsHandler.HandleJoinRequest)

	// Collections routes (per-group)
	groups.POST(":group_id/collections", middleware.RequireAuth(authService), collectionsHandler.CreateCollection)
	groups.GET(":group_id/collections", middleware.RequireAuth(authService), collectionsHandler.ListCollections)
	groups.PATCH(":group_id/collections/:collection_id/close", middleware.RequireAuth(authService), collectionsHandler.CloseCollection)
	groups.PATCH(":group_id/collections/:collection_id", middleware.RequireAuth(authService), collectionsHandler.UpdateCollection)
	groups.DELETE(":group_id/collections/:collection_id", middleware.RequireAuth(authService), collectionsHandler.DeleteCollection)

	// Forms & submissions
	api.POST("/collections/:collection_id/form", middleware.RequireAuth(authService), formsHandler.CreateCollectionForm)
	api.GET("/collections/:collection_id/form", middleware.RequireAuth(authService), formsHandler.GetCollectionForm)

	api.GET("/forms/:form_id", middleware.RequireAuth(authService), formsHandler.GetCollectionFormByID)
	api.PATCH("/forms/:form_id", middleware.RequireAuth(authService), formsHandler.UpdateCollectionForm)
	api.DELETE("/forms/:form_id", middleware.RequireAuth(authService), formsHandler.DeleteCollectionForm)

	api.POST("/forms/:form_id/fields", middleware.RequireAuth(authService), formsHandler.CreateCollectionFormField)
	api.GET("/forms/:form_id/fields", middleware.RequireAuth(authService), formsHandler.ListCollectionFormFields)

	api.POST("/forms/:form_id/submissions", middleware.RequireAuth(authService), formsHandler.CreateFormSubmission)
	api.GET("/collections/:collection_id/submissions", middleware.RequireAuth(authService), formsHandler.ListFormSubmissionsByCollection)
	api.GET("/forms/:form_id/submissions/:submission_id", middleware.RequireAuth(authService), formsHandler.GetFormSubmissionByID)
	api.PATCH("/forms/:form_id/submissions/:submission_id", middleware.RequireAuth(authService), formsHandler.UpdateFormSubmission)
	api.DELETE("/forms/:form_id/submissions/:submission_id", middleware.RequireAuth(authService), formsHandler.DeleteFormSubmission)

	api.POST("/submissions/:submission_id/answers", middleware.RequireAuth(authService), formsHandler.AddFormAnswer)
	api.GET("/submissions/:submission_id/answers", middleware.RequireAuth(authService), formsHandler.ListFormAnswersBySubmission)
	api.GET("/answers/:answer_id", middleware.RequireAuth(authService), formsHandler.GetFormAnswerByID)
	api.PATCH("/answers/:answer_id", middleware.RequireAuth(authService), formsHandler.UpdateFormAnswer)
	api.DELETE("/answers/:answer_id", middleware.RequireAuth(authService), formsHandler.DeleteFormAnswer)

	return router
}
